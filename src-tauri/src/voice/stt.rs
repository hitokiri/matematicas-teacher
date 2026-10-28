//! Reconocimiento de voz local (STT): captura el microfono con cpal y transcribe con Whisper
//! (sherpa-onnx). El nino habla en vez de escribir; nada sale de la computadora.

use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use serde::Serialize;
use sherpa_onnx::{
    LinearResampler, OfflineRecognizer, OfflineRecognizerConfig, OfflineWhisperModelConfig,
};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

use super::{download, is_installed, pack_path, Pack, STT_PACKS};

/// Por debajo de esto se considera silencio (RMS). Un microfono normal da ~0.05 al hablar.
const SPEECH_RMS: f32 = 0.012;
/// Se deja de grabar tras este silencio, despues de haber oido voz
const SILENCE: Duration = Duration::from_millis(1_200);
/// Sin oir nada, se rinde
const NO_SPEECH: Duration = Duration::from_secs(7);
/// Tope duro de una grabacion
const MAX_RECORD: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Serialize)]
pub struct SttModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_mb: f64,
    pub is_downloaded: bool,
    pub is_downloading: bool,
    /// 0-100
    pub download_progress: f64,
}

fn stt_dir(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    app.path().app_data_dir().map(|d| d.join("stt")).map_err(|e| e.to_string())
}

fn name_of(pack: &Pack) -> &'static str {
    match pack.id {
        "whisper-turbo" => "Whisper Turbo",
        _ => "Whisper Small",
    }
}

fn description_of(pack: &Pack) -> &'static str {
    match pack.id {
        "whisper-turbo" => "Equilibrado: entiende bien y va rapido en casi cualquier PC.",
        _ => "Ligero para computadoras modestas; un poco menos preciso.",
    }
}

#[tauri::command]
pub fn list_mic_models(app: AppHandle) -> Result<Vec<SttModelInfo>, String> {
    let dir = stt_dir(&app)?;
    Ok(STT_PACKS
        .iter()
        .map(|pack| {
            let progress = download::progress_of(pack);
            SttModelInfo {
                id: pack.id.into(),
                name: name_of(pack).into(),
                description: description_of(pack).into(),
                size_mb: pack.size_mb,
                is_downloaded: is_installed(&dir, pack),
                is_downloading: progress.is_some(),
                download_progress: progress.unwrap_or(0.0),
            }
        })
        .collect())
}

#[tauri::command]
pub fn download_mic_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let pack = super::find_stt_pack(&model_id).ok_or("Modelo de voz desconocido")?;
    download::start(app.clone(), stt_dir(&app)?, pack).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_mic_download(model_id: String) -> Result<(), String> {
    let pack = super::find_stt_pack(&model_id).ok_or("Modelo de voz desconocido")?;
    download::cancel(pack);
    Ok(())
}

#[tauri::command]
pub fn delete_mic_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let pack = super::find_stt_pack(&model_id).ok_or("Modelo de voz desconocido")?;
    if is_listening() {
        return Err("Espera a que termine de escuchar".into());
    }
    unload();
    let path = pack_path(&stt_dir(&app)?, pack);
    if path.exists() {
        std::fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("mic-models-updated", ());
    Ok(())
}

/// Paquete que se usara: el pedido si esta descargado; si no, el mejor disponible.
fn resolve_pack(dir: &Path, model_id: Option<&str>) -> Result<&'static Pack, String> {
    if let Some(id) = model_id {
        let pack = super::find_stt_pack(id).ok_or("Modelo de voz desconocido")?;
        if !is_installed(dir, pack) {
            return Err("El modelo de voz no esta descargado".into());
        }
        return Ok(pack);
    }
    STT_PACKS
        .iter()
        .copied()
        .find(|pack| is_installed(dir, pack))
        .ok_or_else(|| "Descarga un modelo de voz en Configuracion para usar el microfono".into())
}

/// Motor de reconocimiento cargado (tarda en abrir; se reutiliza mientras no cambie)
static ENGINE: Mutex<Option<(String, OfflineRecognizer)>> = Mutex::new(None);
/// Grabacion en curso: la bandera la pone en `true` el boton o el detector de silencio
static RECORDER: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);

fn unload() {
    if let Ok(mut guard) = ENGINE.lock() {
        *guard = None;
    }
}

fn is_listening() -> bool {
    RECORDER.lock().map(|guard| guard.is_some()).unwrap_or(false)
}

#[tauri::command]
pub fn mic_listening() -> bool {
    is_listening()
}

fn model_files(dir: &Path) -> Result<(String, String, String)> {
    let entries: Vec<PathBuf> = std::fs::read_dir(dir)
        .map_err(|_| anyhow!("El modelo de voz esta incompleto"))?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|e| e == "onnx"))
        .collect();
    let find = |part: &str, int8: bool| {
        entries.iter().find(|p| {
            p.file_name().and_then(|n| n.to_str()).is_some_and(|n| {
                n.contains(part) && (n.contains(".int8.onnx") == int8)
            })
        })
    };
    // Encoder y decoder deben ser de la misma precision
    let (encoder, decoder) = ["int8", "full"]
        .iter()
        .find_map(|kind| {
            let int8 = *kind == "int8";
            Some((find("encoder", int8)?.clone(), find("decoder", int8)?.clone()))
        })
        .ok_or_else(|| anyhow!("El modelo de voz esta incompleto"))?;
    let tokens = std::fs::read_dir(dir)
        .map_err(|_| anyhow!("El modelo de voz esta incompleto"))?
        .flatten()
        .map(|e| e.path())
        .find(|p| p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.ends_with("tokens.txt")))
        .ok_or_else(|| anyhow!("El modelo de voz esta incompleto"))?;
    let s = |p: PathBuf| p.to_str().map(str::to_string).ok_or_else(|| anyhow!("Ruta no valida"));
    Ok((s(encoder)?, s(decoder)?, s(tokens)?))
}

fn config_for(dir: &Path, language: &str) -> Result<OfflineRecognizerConfig> {
    let (encoder, decoder, tokens) = model_files(dir)?;
    let threads = std::thread::available_parallelism().map(|n| n.get() as i32).unwrap_or(2).clamp(1, 4);
    let mut config = OfflineRecognizerConfig::default();
    config.model_config.whisper = OfflineWhisperModelConfig {
        encoder: Some(encoder),
        decoder: Some(decoder),
        language: Some(if language == "en" { "en" } else { "es" }.into()),
        task: Some("transcribe".into()),
        tail_paddings: -1,
        ..Default::default()
    };
    config.model_config.tokens = Some(tokens);
    config.model_config.num_threads = threads;
    config.model_config.provider = Some("cpu".into());
    Ok(config)
}

fn to_16k(samples: &[f32], sample_rate: i32) -> Result<Vec<f32>> {
    if sample_rate == 16_000 {
        return Ok(samples.to_vec());
    }
    let resampler = LinearResampler::create(sample_rate, 16_000)
        .ok_or_else(|| anyhow!("No se pudo preparar el audio"))?;
    Ok(resampler.resample(samples, true))
}

/// Transcribe muestras PCM mono (bloqueante: llamar desde un hilo aparte).
pub fn transcribe(
    stt_dir: &Path,
    pack: &Pack,
    samples: &[f32],
    sample_rate: i32,
    language: &str,
) -> Result<String> {
    if !is_installed(stt_dir, pack) {
        return Err(anyhow!("El modelo de voz no esta descargado"));
    }
    let audio = to_16k(samples, sample_rate)?;
    if audio.is_empty() {
        return Ok(String::new());
    }
    let mut guard = ENGINE.lock().map_err(|_| anyhow!("El motor de voz fallo antes"))?;
    let key = format!("{}:{language}", pack.id);
    if guard.as_ref().map(|(k, _)| k.as_str()) != Some(key.as_str()) {
        *guard = None; // soltar el anterior antes de cargar otro
        log::info!("Cargando el modelo de voz «{}»", pack.id);
        let model = pack_path(stt_dir, pack);
        let recognizer = OfflineRecognizer::create(&config_for(&model, language)?)
            .ok_or_else(|| anyhow!("No se pudo cargar el modelo de voz"))?;
        *guard = Some((key, recognizer));
    }
    let recognizer = &guard.as_ref().expect("motor cargado arriba").1;
    let stream = recognizer.create_stream();
    stream.accept_waveform(16_000, &audio);
    recognizer.decode(&stream);
    Ok(stream.get_result().map(|r| r.text.trim().to_string()).unwrap_or_default())
}

struct Capture {
    samples: Vec<f32>,
    heard: bool,
    last_loud: Instant,
    started: Instant,
}

fn make_stream<T, F>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    capture: Arc<Mutex<Capture>>,
    stop: Arc<AtomicBool>,
    error: Arc<Mutex<Option<String>>>,
    convert: F,
) -> Result<cpal::Stream>
where
    T: cpal::SizedSample + Send + 'static,
    F: Fn(T) -> f32 + Send + 'static,
{
    let channels = config.channels.max(1) as usize;
    let stop_data = stop.clone();
    let stop_error = stop;
    let stream = device
        .build_input_stream::<T, _, _>(
            config.clone(),
            move |data: &[T], _: &_| {
                let mut c = match capture.lock() {
                    Ok(c) => c,
                    Err(_) => return,
                };
                let mut sum_sq = 0.0f32;
                let mut frames = 0usize;
                for frame in data.chunks(channels) {
                    let mut value = 0.0f32;
                    for &sample in frame {
                        value += convert(sample);
                    }
                    value /= frame.len().max(1) as f32;
                    c.samples.push(value);
                    sum_sq += value * value;
                    frames += 1;
                }
                if frames > 0 {
                    let rms = (sum_sq / frames as f32).sqrt();
                    if rms > SPEECH_RMS {
                        c.heard = true;
                        c.last_loud = Instant::now();
                    }
                }
                let elapsed = c.started.elapsed();
                let silent = c.heard && c.last_loud.elapsed() > SILENCE;
                if silent || (!c.heard && elapsed > NO_SPEECH) || elapsed > MAX_RECORD {
                    stop_data.store(true, Ordering::Relaxed);
                }
            },
            move |e| {
                if let Ok(mut slot) = error.lock() {
                    *slot = Some(e.to_string());
                }
                stop_error.store(true, Ordering::Relaxed);
            },
            None,
        )
        .map_err(|e| anyhow!("No se pudo abrir el microfono: {e}"))?;
    Ok(stream)
}

/// Graba hasta que haya silencio (o hasta el tope) y devuelve las muestras mono originales.
fn capture(stop: Arc<AtomicBool>) -> Result<(Vec<f32>, i32)> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| anyhow!("No se encontro ningun microfono"))?;
    let supported = device
        .default_input_config()
        .map_err(|e| anyhow!("El microfono no esta disponible: {e}"))?;
    let sample_rate = supported.sample_rate() as i32;
    let format = supported.sample_format();
    let config = supported.config();
    let capture = Arc::new(Mutex::new(Capture {
        samples: Vec::with_capacity(sample_rate as usize * 20),
        heard: false,
        last_loud: Instant::now(),
        started: Instant::now(),
    }));
    let error = Arc::new(Mutex::new(None::<String>));

    let stream = match format {
        SampleFormat::F32 => {
            make_stream::<f32, _>(&device, &config, capture.clone(), stop.clone(), error.clone(), |v| v)?
        }
        SampleFormat::I16 => make_stream::<i16, _>(
            &device,
            &config,
            capture.clone(),
            stop.clone(),
            error.clone(),
            |v| v as f32 / 32_768.0,
        )?,
        SampleFormat::U16 => make_stream::<u16, _>(
            &device,
            &config,
            capture.clone(),
            stop.clone(),
            error.clone(),
            |v| (v as f32 - 32_768.0) / 32_768.0,
        )?,
        other => return Err(anyhow!("Formato de microfono no soportado: {other}")),
    };

    stream.play().map_err(|e| anyhow!("No se pudo escuchar el microfono: {e}"))?;
    while !stop.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(40));
    }
    drop(stream);

    if let Some(message) = error.lock().ok().and_then(|g| g.clone()) {
        return Err(anyhow!("El microfono fallo: {message}"));
    }
    let mut c = capture.lock().map_err(|_| anyhow!("La grabacion fallo"))?;
    if !c.heard {
        return Ok((Vec::new(), sample_rate));
    }
    Ok((std::mem::take(&mut c.samples), sample_rate))
}

fn record_and_transcribe(
    app: &AppHandle,
    dir: &Path,
    pack: &'static Pack,
    language: &str,
    stop: Arc<AtomicBool>,
) -> Result<String> {
    let (samples, sample_rate) = capture(stop)?;
    if samples.is_empty() {
        return Ok(String::new());
    }
    let _ = app.emit("mic-state", serde_json::json!({ "state": "transcribing" }));
    transcribe(dir, pack, &samples, sample_rate, language)
}

#[tauri::command]
pub fn start_listening(
    app: AppHandle,
    language: Option<String>,
    model_id: Option<String>,
) -> Result<(), String> {
    let dir = stt_dir(&app)?;
    let pack = resolve_pack(&dir, model_id.as_deref())?;
    let language = if language.as_deref() == Some("en") { "en" } else { "es" }.to_string();
    let stop = Arc::new(AtomicBool::new(false));
    {
        let mut guard = RECORDER.lock().map_err(|_| "El microfono fallo antes")?;
        if guard.is_some() {
            return Err("El microfono ya esta grabando".into());
        }
        *guard = Some(stop.clone());
    }
    let _ = app.emit("mic-state", serde_json::json!({ "state": "recording" }));
    let app_thread = app.clone();
    std::thread::spawn(move || {
        let result = record_and_transcribe(&app_thread, &dir, pack, &language, stop.clone());
        if let Ok(mut guard) = RECORDER.lock() {
            if guard.as_ref().is_some_and(|flag| Arc::ptr_eq(flag, &stop)) {
                *guard = None;
            }
        }
        match result {
            Ok(text) if !text.is_empty() => {
                let _ = app_thread.emit(
                    "mic-transcript",
                    serde_json::json!({ "text": text, "language": language }),
                );
            }
            Ok(_) => {
                let _ = app_thread.emit("mic-state", serde_json::json!({ "state": "empty" }));
            }
            Err(e) => {
                log::warn!("El microfono no pudo transcribir: {e}");
                let _ = app_thread.emit("mic-error", serde_json::json!({ "message": e.to_string() }));
            }
        }
        let _ = app_thread.emit("mic-state", serde_json::json!({ "state": "idle" }));
    });
    Ok(())
}

#[tauri::command]
pub fn stop_listening() -> Result<(), String> {
    let flag = RECORDER
        .lock()
        .map_err(|_| "El microfono fallo antes")?
        .as_ref()
        .cloned();
    if let Some(flag) = flag {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}
