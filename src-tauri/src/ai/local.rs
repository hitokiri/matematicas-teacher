//! Inferencia local dentro de la app (como Handy con whisper): llama.cpp va enlazado
//! en el binario, el GGUF activo se carga en memoria y no se abre ningun puerto.
//!
//! Los backends de ggml (CPU, CUDA, ...) son modulos que se cargan al arrancar: si la PC
//! tiene GPU NVIDIA con driver se usa la GPU; si no, el modulo CUDA no carga y se usa CPU.

use anyhow::Result;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{LlamaChatMessage, LlamaChatTemplate, LlamaModel};
use llama_cpp_2::mtmd::{MtmdBitmap, MtmdContext, MtmdContextParams, MtmdInputText};
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::{list_llama_ggml_backend_devices, LlamaBackendDeviceType};
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

const N_CTX: u32 = 8192;
const N_BATCH: u32 = 2048;
const MAX_NEW_TOKENS: usize = 2048;
/// Margen de VRAM para el contexto (KV cache) y buffers de computo
const VRAM_MARGIN: u64 = 1536 * 1024 * 1024;

/// Archivos del modelo activo
#[derive(Debug, Clone, PartialEq)]
pub struct LocalModel {
    pub model: PathBuf,
    /// Proyector de vision; si existe el modelo puede leer dibujos
    pub mmproj: Option<PathBuf>,
}

struct Loaded {
    files: LocalModel,
    /// Se declara antes que `model`: debe liberarse primero porque lo referencia
    mtmd: Option<MtmdContext>,
    model: LlamaModel,
    /// Dispositivo donde corre ("GPU: ..." o "CPU")
    device: String,
}

static BACKEND: OnceLock<LlamaBackend> = OnceLock::new();
/// Modelo cargado en memoria
static LOADED: Mutex<Option<Loaded>> = Mutex::new(None);

fn backend() -> Result<&'static LlamaBackend> {
    if let Some(b) = BACKEND.get() {
        return Ok(b);
    }
    // Solo un hilo inicializa (la precarga y la deteccion de hardware arrancan a la vez)
    static INIT: Mutex<()> = Mutex::new(());
    let _init = INIT.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(b) = BACKEND.get() {
        return Ok(b);
    }
    llama_cpp_2::send_logs_to_tracing(llama_cpp_2::LogOptions::default().with_logs_enabled(false));
    // Modulos de backend: junto al ejecutable (desarrollo), en ../lib/matematicas-teacher (app
    // instalada) o, si no, en la carpeta donde se compilaron
    let bundled = std::env::current_exe().ok()
        .and_then(|exe| exe.parent().map(|d| d.to_path_buf()))
        .and_then(|dir| {
            [dir.join("backends"), dir.join("../lib/matematicas-teacher/backends")]
                .into_iter()
                .find(|d| d.is_dir())
        });
    match bundled {
        Some(dir) => llama_cpp_2::llama_backend::load_backends_from_path(&dir),
        None => llama_cpp_2::llama_backend::load_backends(),
    }
    let b = LlamaBackend::init().map_err(|e| anyhow::anyhow!("No se pudo iniciar llama.cpp: {}", e))?;
    Ok(BACKEND.get_or_init(|| b))
}

/// GPU dedicada con mas memoria libre: (indice, descripcion, bytes libres)
fn best_gpu() -> Option<(usize, String, u64)> {
    list_llama_ggml_backend_devices().into_iter()
        .filter(|d| matches!(d.device_type, LlamaBackendDeviceType::Gpu))
        .max_by_key(|d| d.memory_free)
        .map(|d| (d.index, d.description, d.memory_free as u64))
}

/// Descripcion del hardware disponible para la inferencia local
pub fn compute_device() -> String {
    if backend().is_err() {
        return "CPU".to_string();
    }
    if let Some(loaded) = LOADED.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
        return loaded.device.clone();
    }
    match best_gpu() {
        Some((_, name, free)) => format!("GPU: {} ({:.1} GB libres)", name, free as f64 / 1e9),
        None => "CPU".to_string(),
    }
}

/// Memoria para modelos en MB: (VRAM total de la mejor GPU, RAM total)
pub fn hardware_mb() -> (Option<f64>, f64) {
    let gpu = backend().ok().and_then(|_| {
        list_llama_ggml_backend_devices().into_iter()
            .filter(|d| matches!(d.device_type, LlamaBackendDeviceType::Gpu))
            .map(|d| d.memory_total as f64 / 1048576.0)
            .max_by(f64::total_cmp)
    });
    // /proc/meminfo: "MemTotal:  32768000 kB"
    let ram = std::fs::read_to_string("/proc/meminfo").ok()
        .and_then(|m| m.lines().find(|l| l.starts_with("MemTotal:"))
            .and_then(|l| l.split_whitespace().nth(1)?.parse::<f64>().ok()))
        .map(|kb| kb / 1024.0)
        .unwrap_or(8192.0);
    (gpu, ram)
}

/// Capas del modelo y si es mixture-of-experts, leidos de la cabecera del GGUF
fn gguf_layers(path: &Path) -> Option<(u32, bool)> {
    let gguf = llama_cpp_2::gguf::GgufContext::from_file(path)?;
    let arch = gguf.val_str(gguf.find_key("general.architecture"))?.to_string();
    let key = |k: &str| Some(gguf.find_key(&format!("{}.{}", arch, k))).filter(|i| *i >= 0);
    let layers = gguf.val_u32(key("block_count")?);
    let moe = key("expert_count").map(|i| gguf.val_u32(i) > 0).unwrap_or(false);
    Some((layers, moe))
}

/// Elige donde corre el modelo:
/// - cabe entero en la GPU: todas las capas en la GPU
/// - mixture-of-experts que no cabe: capas en la GPU y expertos en la CPU (como --cpu-moe)
/// - denso que no cabe: tantas capas en la GPU como quepan, el resto en CPU
/// - sin GPU: CPU
fn model_params(files: &LocalModel) -> (Pin<Box<LlamaModelParams>>, String) {
    let size = |p: &Path| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    let model_size = size(&files.model);
    let extra = files.mmproj.as_deref().map(size).unwrap_or(0) + VRAM_MARGIN;
    let on_gpu = |index: usize, layers: u32| {
        LlamaModelParams::default()
            .with_n_gpu_layers(layers)
            .with_devices(&[index])
            .unwrap_or_else(|_| LlamaModelParams::default().with_n_gpu_layers(layers))
    };
    let cpu = || Box::pin(LlamaModelParams::default().with_n_gpu_layers(0));

    let Some((index, name, free)) = best_gpu() else { return (cpu(), "CPU".to_string()) };
    if free >= model_size + extra {
        return (Box::pin(on_gpu(index, u32::MAX)), format!("GPU: {}", name));
    }
    match gguf_layers(&files.model) {
        Some((_, true)) => {
            let mut params = Box::pin(on_gpu(index, u32::MAX));
            params.as_mut().add_cpu_moe_override();
            (params, format!("GPU + CPU: {} (expertos en CPU)", name))
        }
        Some((layers, false)) if free > extra && model_size > 0 => {
            let fit = ((free - extra) as f64 / model_size as f64 * layers as f64) as u32;
            if fit == 0 {
                return (cpu(), format!("CPU (el modelo no cabe en {})", name));
            }
            (Box::pin(on_gpu(index, fit)), format!("GPU + CPU: {} ({} de {} capas en GPU)", name, fit, layers))
        }
        _ => (cpu(), format!("CPU (el modelo no cabe en {})", name)),
    }
}

fn threads() -> i32 {
    std::thread::available_parallelism().map(|n| n.get() as i32).unwrap_or(4)
}

/// Carga el modelo si no es el que ya esta en memoria (bloqueante)
fn ensure_loaded(guard: &mut Option<Loaded>, files: &LocalModel) -> Result<()> {
    if matches!(guard, Some(l) if &l.files == files) {
        return Ok(());
    }
    *guard = None; // liberar el modelo anterior antes de cargar el nuevo
    for f in std::iter::once(&files.model).chain(files.mmproj.as_ref()) {
        if !f.is_file() {
            return Err(anyhow::anyhow!("Falta el archivo del modelo: {}. Vuelve a descargarlo en Configuracion.", f.display()));
        }
    }
    let backend = backend()?;
    let (params, device) = model_params(files);
    let model = LlamaModel::load_from_file(backend, &files.model, &*params)
        .map_err(|e| anyhow::anyhow!("No se pudo cargar el modelo {}: {}", files.model.display(), e))?;
    let mtmd = match &files.mmproj {
        Some(mmproj) => {
            let mut mparams = MtmdContextParams::default();
            mparams.use_gpu = device.starts_with("GPU");
            mparams.n_threads = threads();
            mparams.print_timings = false;
            let path = mmproj.to_str().ok_or_else(|| anyhow::anyhow!("Ruta invalida: {}", mmproj.display()))?;
            Some(MtmdContext::init_from_file(path, &model, &mparams)
                .map_err(|e| anyhow::anyhow!("No se pudo cargar el proyector de vision: {}", e))?)
        }
        None => None,
    };
    *guard = Some(Loaded { files: files.clone(), mtmd, model, device });
    Ok(())
}

/// Precarga el modelo en segundo plano (al seleccionarlo, como Handy)
pub fn preload(files: LocalModel) {
    std::thread::spawn(move || {
        let mut guard = LOADED.lock().unwrap_or_else(|e| e.into_inner());
        if let Err(e) = ensure_loaded(&mut guard, &files) {
            eprintln!("{}", e);
        }
    });
}

/// Libera el modelo de memoria (p. ej. antes de borrarlo)
pub fn unload() {
    *LOADED.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// Un turno de la conversacion: ("user" | "assistant", texto)
pub type Turn = (String, String);

/// Genera la respuesta del asistente para (system, user) y opcionalmente una imagen
/// (bytes PNG/JPEG). Bloqueante.
pub fn generate(
    files: &LocalModel,
    system: &str,
    user: &str,
    image: Option<&[u8]>,
    grammar: Option<&str>,
) -> Result<Generation> {
    generate_chat(files, system, &[("user".into(), user.into())], image, grammar, MAX_NEW_TOKENS)
}

/// Como `generate`, pero con una conversacion de varios turnos (chat de preguntas)
pub fn generate_chat(
    files: &LocalModel,
    system: &str,
    turns: &[Turn],
    image: Option<&[u8]>,
    grammar: Option<&str>,
    max_tokens: usize,
) -> Result<Generation> {
    let mut guard = LOADED.lock().unwrap_or_else(|e| e.into_inner());
    ensure_loaded(&mut guard, files)?;
    let loaded = guard.as_ref().expect("modelo cargado");
    let model = &loaded.model;

    let mtmd = match (image, &loaded.mtmd) {
        (Some(_), None) => {
            return Err(anyhow::anyhow!(
                "El modelo activo no puede leer dibujos. Selecciona en Configuracion un modelo \
                 que \"lee dibujos\", escribe el problema o usa OpenAI/Anthropic."
            ))
        }
        (Some(_), Some(m)) => Some(m),
        (None, _) => None,
    };

    // La imagen va al principio del primer mensaje del usuario
    let mut messages: Vec<Turn> = vec![("system".into(), system.into())];
    messages.extend(turns.iter().cloned());
    if mtmd.is_some() {
        if let Some(first) = messages.iter_mut().find(|(role, _)| role == "user") {
            first.1 = format!("{}\n{}", llama_cpp_2::mtmd::mtmd_default_marker(), first.1);
        }
    }
    let prompt = render_prompt(model, &messages)?;

    let params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(N_CTX))
        .with_n_batch(N_BATCH)
        .with_n_ubatch(N_BATCH)
        .with_n_threads(threads())
        .with_n_threads_batch(threads());
    let mut ctx = model.new_context(backend()?, params)
        .map_err(|e| anyhow::anyhow!("No se pudo crear el contexto del modelo: {}", e))?;

    // Evaluar el prompt: con imagen via mtmd (codifica la imagen y el texto), si no por lotes
    let vocab = model.vocab();
    let mut pos: i32 = match (mtmd, image) {
        (Some(mtmd), Some(bytes)) => {
            let bitmap = MtmdBitmap::from_buffer(mtmd, bytes, false)
                .map_err(|e| anyhow::anyhow!("No se pudo leer el dibujo: {}", e))?;
            let chunks = mtmd.tokenize(
                MtmdInputText { text: prompt, add_special: false, parse_special: true },
                &[&bitmap],
            ).map_err(|e| anyhow::anyhow!("No se pudo preparar el dibujo: {}", e))?;
            if chunks.total_tokens() >= N_CTX as usize {
                return Err(anyhow::anyhow!("El dibujo es demasiado grande para el modelo local."));
            }
            chunks.eval_chunks(mtmd, &ctx, 0, 0, N_BATCH as i32, true)
                .map_err(|e| anyhow::anyhow!("El modelo no pudo procesar el dibujo: {}", e))?
        }
        _ => {
            let tokens = vocab.tokenize(prompt.as_bytes(), false, true);
            if tokens.len() >= N_CTX as usize {
                return Err(anyhow::anyhow!("El problema es demasiado largo para el modelo local."));
            }
            for chunk_start in (0..tokens.len()).step_by(N_BATCH as usize) {
                let chunk = &tokens[chunk_start..(chunk_start + N_BATCH as usize).min(tokens.len())];
                let mut batch = LlamaBatch::new(chunk.len(), 1);
                for (i, t) in chunk.iter().enumerate() {
                    let p = chunk_start + i;
                    batch.add(*t, p as i32, &[0], p == tokens.len() - 1)?;
                }
                ctx.decode(&mut batch)?;
            }
            tokens.len() as i32
        }
    };

    // Con gramatica (p. ej. JSON de un esquema) el modelo solo puede generar texto valido
    let mut grammar = match grammar {
        Some(g) => Some(LlamaSampler::grammar(model, g, "root")
            .map_err(|e| anyhow::anyhow!("Gramatica invalida: {}", e))?),
        None => None,
    };
    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::top_k(40),
        LlamaSampler::top_p(0.95, 1),
        LlamaSampler::temp(0.3),
        LlamaSampler::dist(1234),
    ]);
    let mut batch = LlamaBatch::new(1, 1);
    let mut out = Vec::new();
    let started = Instant::now();
    let mut generated = 0usize;
    let budget = max_tokens.min((N_CTX as i32 - pos).max(0) as usize);
    for _ in 0..budget {
        let mut tok = sampler.sample(&ctx, -1);
        if let Some(g) = grammar.as_mut() {
            tok = constrain(g, &sampler, &ctx, tok);
        }
        if vocab.is_eog(tok) {
            break;
        }
        out.extend(vocab.token_to_piece(tok, false, None));
        generated += 1;
        batch.clear();
        batch.add(tok, pos, &[0], true)?;
        pos += 1;
        ctx.decode(&mut batch)?;
    }
    let secs = started.elapsed().as_secs_f64();
    let tokens_per_second = if secs > 0.0 { generated as f64 / secs } else { 0.0 };
    Ok(Generation { text: strip_thinking(&String::from_utf8_lossy(&out)), tokens_per_second })
}

/// Como llama-server: se muestrea sin gramatica y solo si el token no la cumple se aplica
/// la gramatica a todo el vocabulario (~250 mil tokens en Qwen3.5), que es lo costoso.
fn constrain(grammar: &mut LlamaSampler, sampler: &LlamaSampler, ctx: &llama_cpp_2::context::LlamaContext, tok: llama_cpp_2::token::LlamaToken) -> llama_cpp_2::token::LlamaToken {
    use llama_cpp_2::token::data::LlamaTokenData;
    use llama_cpp_2::token::data_array::LlamaTokenDataArray;
    let mut single = LlamaTokenDataArray::new(vec![LlamaTokenData::new(tok, 1.0, 0.0)], false);
    single.apply_sampler(grammar);
    let tok = if single.data[0].logit().is_finite() {
        tok
    } else {
        let mut all = ctx.token_data_array();
        all.apply_sampler(grammar);
        all.apply_sampler(sampler);
        all.selected_token().unwrap_or(tok)
    };
    grammar.accept(tok);
    tok
}

/// Velocidad de la ultima respuesta (tokens/s), para mostrarla en la lista de modelos
static LAST_SPEED: Mutex<Option<f64>> = Mutex::new(None);

pub fn record_speed(tokens_per_second: f64) {
    *LAST_SPEED.lock().unwrap_or_else(|e| e.into_inner()) = Some(tokens_per_second);
}

pub fn take_last_speed() -> Option<f64> {
    LAST_SPEED.lock().unwrap_or_else(|e| e.into_inner()).take()
}

/// Respuesta generada y velocidad medida
pub struct Generation {
    pub text: String,
    pub tokens_per_second: f64,
}

/// Quita el razonamiento interno (`<think>...</think>`) si el modelo lo genero
pub(crate) fn strip_thinking(text: &str) -> String {
    let text = match text.rfind("</think>") {
        Some(end) => &text[end + "</think>".len()..],
        None => text,
    };
    text.trim().to_string()
}

/// Construye el prompt con la plantilla Jinja del propio GGUF (como llama-server), sin modo
/// "pensar". Si la plantilla no se puede renderizar, usa el motor de plantillas de llama.cpp.
fn render_prompt(model: &LlamaModel, messages: &[Turn]) -> Result<String> {
    if let Ok(source) = model.meta_val_str("tokenizer.chat_template") {
        let vocab = model.vocab();
        let piece = |t| String::from_utf8_lossy(&vocab.token_to_piece(t, true, None)).to_string();
        match render_jinja(&source, messages, &piece(vocab.bos()), &piece(vocab.eos())) {
            Ok(prompt) => return Ok(prompt),
            Err(e) => eprintln!("Plantilla Jinja no soportada, se usa la de llama.cpp: {}", e),
        }
    }
    let tmpl = match model.chat_template(None) {
        Ok(t) => t,
        Err(_) => LlamaChatTemplate::new("chatml")?,
    };
    let chat = messages.iter()
        .map(|(role, content)| LlamaChatMessage::new(role.clone(), content.clone()))
        .collect::<Result<Vec<_>, _>>()?;
    model.apply_chat_template(&tmpl, &chat, true)
        .map_err(|e| anyhow::anyhow!("No se pudo aplicar la plantilla de chat: {}", e))
}

pub(crate) fn render_jinja(source: &str, messages: &[Turn], bos: &str, eos: &str) -> Result<String> {
    let mut env = minijinja::Environment::new();
    env.set_unknown_method_callback(minijinja_contrib::pycompat::unknown_method_callback);
    env.add_function("raise_exception", |msg: String| -> Result<String, minijinja::Error> {
        Err(minijinja::Error::new(minijinja::ErrorKind::InvalidOperation, msg))
    });
    env.add_function("strftime_now", |_fmt: String| chrono::Local::now().format("%d %B %Y").to_string());
    env.add_template("chat", source)?;
    let prompt = env.get_template("chat")?.render(minijinja::context! {
        messages => messages.iter()
            .map(|(role, content)| minijinja::context! { role => role, content => content })
            .collect::<Vec<_>>(),
        add_generation_prompt => true,
        enable_thinking => false,
        bos_token => bos,
        eos_token => eos,
    })?;
    Ok(prompt)
}
