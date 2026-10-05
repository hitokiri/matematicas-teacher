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
use std::sync::{Mutex, OnceLock};

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
    llama_cpp_2::send_logs_to_tracing(llama_cpp_2::LogOptions::default().with_logs_enabled(false));
    // App empaquetada: los modulos van junto al ejecutable; en desarrollo, en OUT_DIR
    let bundled = std::env::current_exe().ok()
        .and_then(|exe| exe.parent().map(|d| d.join("backends")))
        .filter(|d| d.is_dir());
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

/// Elige GPU si hay una con VRAM suficiente para el modelo completo; si no, CPU
fn model_params(files: &LocalModel) -> (LlamaModelParams, String) {
    let size = |p: &Path| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    let needed = size(&files.model) + files.mmproj.as_deref().map(size).unwrap_or(0) + VRAM_MARGIN;
    match best_gpu() {
        Some((index, name, free)) if free >= needed => {
            let params = LlamaModelParams::default()
                .with_n_gpu_layers(u32::MAX)
                .with_devices(&[index])
                .unwrap_or_else(|_| LlamaModelParams::default().with_n_gpu_layers(u32::MAX));
            (params, format!("GPU: {}", name))
        }
        Some((_, name, _)) => (
            LlamaModelParams::default().with_n_gpu_layers(0),
            format!("CPU (el modelo no cabe en la memoria de {})", name),
        ),
        None => (LlamaModelParams::default().with_n_gpu_layers(0), "CPU".to_string()),
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
    let backend = backend()?;
    let (params, device) = model_params(files);
    let model = LlamaModel::load_from_file(backend, &files.model, &params)
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

/// Genera la respuesta del asistente para (system, user) y opcionalmente una imagen
/// (bytes PNG/JPEG). Bloqueante.
pub fn generate(files: &LocalModel, system: &str, user: &str, image: Option<&[u8]>) -> Result<String> {
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

    // Plantilla de chat del propio GGUF; chatml si no trae ninguna
    let tmpl = match model.chat_template(None) {
        Ok(t) => t,
        Err(_) => LlamaChatTemplate::new("chatml")?,
    };
    let user = match mtmd {
        Some(_) => format!("{}\n{}", llama_cpp_2::mtmd::mtmd_default_marker(), user),
        None => user.to_string(),
    };
    let chat = [
        LlamaChatMessage::new("system".into(), system.into())?,
        LlamaChatMessage::new("user".into(), user)?,
    ];
    let prompt = model.apply_chat_template(&tmpl, &chat, true)
        .map_err(|e| anyhow::anyhow!("No se pudo aplicar la plantilla de chat: {}", e))?;

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

    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::top_k(40),
        LlamaSampler::top_p(0.95, 1),
        LlamaSampler::temp(0.3),
        LlamaSampler::dist(1234),
    ]);
    let mut batch = LlamaBatch::new(1, 1);
    let mut out = Vec::new();
    let budget = MAX_NEW_TOKENS.min((N_CTX as i32 - pos).max(0) as usize);
    for _ in 0..budget {
        let tok = sampler.sample(&ctx, -1);
        if vocab.is_eog(tok) {
            break;
        }
        out.extend(vocab.token_to_piece(tok, false, None));
        batch.clear();
        batch.add(tok, pos, &[0], true)?;
        pos += 1;
        ctx.decode(&mut batch)?;
    }
    Ok(String::from_utf8_lossy(&out).trim().to_string())
}
