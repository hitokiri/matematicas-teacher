//! Inferencia local dentro de la app (como Handy con whisper): llama.cpp va enlazado
//! en el binario, el GGUF activo se carga en memoria y no se abre ningun puerto.

use anyhow::Result;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{LlamaChatMessage, LlamaChatTemplate, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

const N_CTX: u32 = 4096;
const MAX_NEW_TOKENS: usize = 2048;

static BACKEND: OnceLock<LlamaBackend> = OnceLock::new();
/// Modelo cargado en memoria: (ruta del GGUF, modelo)
static LOADED: Mutex<Option<(PathBuf, LlamaModel)>> = Mutex::new(None);

fn backend() -> Result<&'static LlamaBackend> {
    if let Some(b) = BACKEND.get() {
        return Ok(b);
    }
    llama_cpp_2::send_logs_to_tracing(llama_cpp_2::LogOptions::default().with_logs_enabled(false));
    let b = LlamaBackend::init().map_err(|e| anyhow::anyhow!("No se pudo iniciar llama.cpp: {}", e))?;
    Ok(BACKEND.get_or_init(|| b))
}

/// Carga el GGUF si no es el que ya esta en memoria (bloqueante)
fn ensure_loaded(guard: &mut Option<(PathBuf, LlamaModel)>, path: &Path) -> Result<()> {
    if matches!(guard, Some((p, _)) if p == path) {
        return Ok(());
    }
    *guard = None; // liberar el modelo anterior antes de cargar el nuevo
    let model = LlamaModel::load_from_file(backend()?, path, &LlamaModelParams::default())
        .map_err(|e| anyhow::anyhow!("No se pudo cargar el modelo {}: {}", path.display(), e))?;
    *guard = Some((path.to_path_buf(), model));
    Ok(())
}

/// Precarga el modelo en segundo plano (al seleccionarlo, como Handy)
pub fn preload(path: PathBuf) {
    std::thread::spawn(move || {
        let mut guard = LOADED.lock().unwrap_or_else(|e| e.into_inner());
        if let Err(e) = ensure_loaded(&mut guard, &path) {
            eprintln!("{}", e);
        }
    });
}

/// Libera el modelo de memoria (p. ej. antes de borrarlo)
pub fn unload() {
    *LOADED.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// Genera la respuesta del asistente para (system, user) con el GGUF dado (bloqueante)
pub fn generate(path: &Path, system: &str, user: &str) -> Result<String> {
    let mut guard = LOADED.lock().unwrap_or_else(|e| e.into_inner());
    ensure_loaded(&mut guard, path)?;
    let model = &guard.as_ref().expect("modelo cargado").1;

    // Plantilla de chat del propio GGUF; chatml si no trae ninguna
    let tmpl = match model.chat_template(None) {
        Ok(t) => t,
        Err(_) => LlamaChatTemplate::new("chatml")?,
    };
    let chat = [
        LlamaChatMessage::new("system".into(), system.into())?,
        LlamaChatMessage::new("user".into(), user.into())?,
    ];
    let prompt = model.apply_chat_template(&tmpl, &chat, true)
        .map_err(|e| anyhow::anyhow!("No se pudo aplicar la plantilla de chat: {}", e))?;

    let vocab = model.vocab();
    let tokens = vocab.tokenize(prompt.as_bytes(), false, true);
    if tokens.len() >= N_CTX as usize {
        return Err(anyhow::anyhow!("El problema es demasiado largo para el modelo local."));
    }

    let threads = std::thread::available_parallelism().map(|n| n.get() as i32).unwrap_or(4);
    let params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(N_CTX))
        .with_n_batch(N_CTX)
        .with_n_threads(threads)
        .with_n_threads_batch(threads);
    let mut ctx = model.new_context(backend()?, params)
        .map_err(|e| anyhow::anyhow!("No se pudo crear el contexto del modelo: {}", e))?;

    let mut batch = LlamaBatch::new(N_CTX as usize, 1);
    let last = tokens.len() - 1;
    for (i, t) in tokens.iter().enumerate() {
        batch.add(*t, i as i32, &[0], i == last)?;
    }
    ctx.decode(&mut batch)?;

    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::top_k(40),
        LlamaSampler::top_p(0.95, 1),
        LlamaSampler::temp(0.3),
        LlamaSampler::dist(1234),
    ]);
    let mut pos = tokens.len() as i32;
    let mut out = Vec::new();
    let budget = MAX_NEW_TOKENS.min(N_CTX as usize - tokens.len());
    for _ in 0..budget {
        let tok = sampler.sample(&ctx, batch.n_tokens() - 1);
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
