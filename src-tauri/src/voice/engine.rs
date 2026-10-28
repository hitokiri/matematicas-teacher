use anyhow::{anyhow, Result};
use sherpa_onnx::{
    GenerationConfig, OfflineTts, OfflineTtsConfig, OfflineTtsKokoroModelConfig, OfflineTtsModelConfig,
    OfflineTtsVitsModelConfig,
};
use std::path::Path;
use std::sync::Mutex;

use super::{pack_path, wav_bytes, Kind, Voice, MAX_TEXT_CHARS};

/// Motor cargado: el modelo pesa y tarda en abrir, asi que se reutiliza mientras no cambie el paquete
/// La clave es paquete + idioma (Kokoro se configura con el idioma al cargarlo)
static ENGINE: Mutex<Option<(String, OfflineTts)>> = Mutex::new(None);

fn path_str(p: &Path) -> Option<String> {
    Some(p.to_str()?.to_string())
}

fn config_for(voices_dir: &Path, voice: &Voice) -> Result<OfflineTtsConfig> {
    let dir = pack_path(voices_dir, voice.pack);
    let file = |name: &str| path_str(&dir.join(name));
    let threads = std::thread::available_parallelism().map(|n| n.get() as i32).unwrap_or(2).clamp(1, 4);
    let model = match voice.pack.kind {
        Kind::Piper => {
            let onnx = std::fs::read_dir(&dir)?
                .flatten()
                .map(|e| e.path())
                .find(|p| p.extension().is_some_and(|e| e == "onnx"))
                .ok_or_else(|| anyhow!("El paquete de voz esta incompleto"))?;
            OfflineTtsModelConfig {
                vits: OfflineTtsVitsModelConfig {
                    model: path_str(&onnx),
                    tokens: file("tokens.txt"),
                    data_dir: file("espeak-ng-data"),
                    ..Default::default()
                },
                num_threads: threads,
                ..Default::default()
            }
        }
        Kind::Whisper => return Err(anyhow!("Ese paquete no es una voz")),
        Kind::Kokoro => OfflineTtsModelConfig {
            kokoro: OfflineTtsKokoroModelConfig {
                model: file("model.onnx"),
                voices: file("voices.bin"),
                tokens: file("tokens.txt"),
                data_dir: file("espeak-ng-data"),
                dict_dir: file("dict"),
                lexicon: Some(format!(
                    "{},{}",
                    dir.join("lexicon-us-en.txt").to_str().unwrap_or_default(),
                    dir.join("lexicon-zh.txt").to_str().unwrap_or_default()
                )),
                lang: Some(if voice.lang == "en" { "en-us" } else { "es" }.into()),
                ..Default::default()
            },
            num_threads: threads,
            ..Default::default()
        },
    };
    Ok(OfflineTtsConfig { model, ..Default::default() })
}

/// Convierte el texto en un WAV con la voz pedida (bloqueante: llamar desde un hilo aparte)
pub fn synthesize(voices_dir: &Path, voice: &Voice, text: &str) -> Result<Vec<u8>> {
    let text = text.trim();
    if text.is_empty() {
        return Err(anyhow!("No hay texto para leer"));
    }
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err(anyhow!("El texto es demasiado largo para leerlo"));
    }
    if !super::is_installed(voices_dir, voice.pack) {
        return Err(anyhow!("La voz no esta descargada"));
    }

    let mut guard = ENGINE.lock().map_err(|_| anyhow!("El motor de voz fallo antes"))?;
    let key = format!("{}:{}", voice.pack.id, voice.lang);
    if guard.as_ref().map(|(k, _)| k.as_str()) != Some(key.as_str()) {
        *guard = None; // soltar el anterior antes de cargar otro
        log::info!("Cargando la voz «{}»", voice.pack.id);
        let tts = OfflineTts::create(&config_for(voices_dir, voice)?)
            .ok_or_else(|| anyhow!("No se pudo cargar la voz (¿faltan archivos? prueba a descargarla otra vez)"))?;
        *guard = Some((key, tts));
    }
    let tts = &guard.as_ref().expect("motor cargado arriba").1;
    let config = GenerationConfig { sid: voice.sid, speed: 1.0, ..Default::default() };
    let audio = tts
        .generate_with_config(text, &config, None::<fn(&[f32], f32) -> bool>)
        .ok_or_else(|| anyhow!("No se pudo generar el audio"))?;
    Ok(wav_bytes(audio.samples(), audio.sample_rate()))
}

/// Suelta el modelo de memoria (antes de borrar sus archivos)
pub fn unload() {
    if let Ok(mut guard) = ENGINE.lock() {
        *guard = None;
    }
}
