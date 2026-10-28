//! Voz natural de la maestra: sintesis de voz local (sin internet) con sherpa-onnx.
//! Dos familias de voz, que el usuario descarga a pedido: Piper (ligera) y Kokoro (mas expresiva).

pub mod commands;
pub mod download;
pub mod engine;
pub mod stt;
pub mod system;

#[cfg(test)]
mod tests;

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    /// Piper (VITS)
    Piper,
    Kokoro,
    /// Reconocimiento de voz (Whisper)
    Whisper,
}

/// Un paquete de modelo descargable (varias voces pueden compartir el mismo)
pub struct Pack {
    pub id: &'static str,
    pub kind: Kind,
    /// Carpeta que queda al extraer el archivo
    pub dir: &'static str,
    pub url: &'static str,
    /// SHA-256 del archivo: lo que no coincida se descarta
    pub sha256: &'static str,
    pub size_mb: f64,
}

pub struct Voice {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub pack: &'static Pack,
    /// Voz dentro del paquete (Kokoro trae varias)
    pub sid: i32,
    /// Idioma que habla: "es" o "en"
    pub lang: &'static str,
}

pub static PIPER: Pack = Pack {
    id: "piper",
    kind: Kind::Piper,
    dir: "vits-piper-es_MX-claude-high",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-claude-high.tar.bz2",
    sha256: "ec33fb689c248fe64810aab564cba97babf0f506672cfd404928d46e751a4721",
    size_mb: 64.0,
};

pub static PIPER_EN: Pack = Pack {
    id: "piper-en",
    kind: Kind::Piper,
    dir: "vits-piper-en_US-lessac-medium",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2",
    sha256: "9e3febfacf0abf4270172d2958bcec246032b7e88efc2720840cc80c93de334e",
    size_mb: 64.0,
};

pub static PIPER_DAVE: Pack = Pack {
    id: "piper-dave",
    kind: Kind::Piper,
    dir: "vits-piper-es_ES-davefx-medium",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-davefx-medium.tar.bz2",
    sha256: "a3f6beb54a9cb893279f72978a22f807a4d9fc9c7848157b524d5cc7b7f58b22",
    size_mb: 64.0,
};

/// Paquetes que ya no se ofrecen: se borran si estaban descargados (Aldo sonaba plano y poco natural)
pub const RETIRED_DIRS: [&str; 1] = ["vits-piper-es_MX-ald-medium"];

/// Borra los paquetes retirados; devuelve cuantos habia
pub fn remove_retired(voices_dir: &Path) -> usize {
    RETIRED_DIRS
        .iter()
        .filter(|dir| {
            let path = voices_dir.join(dir);
            path.is_dir() && std::fs::remove_dir_all(path).is_ok()
        })
        .count()
}

pub static PIPER_JOE: Pack = Pack {
    id: "piper-joe",
    kind: Kind::Piper,
    dir: "vits-piper-en_US-joe-medium",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-joe-medium.tar.bz2",
    sha256: "261b903a1fb2ce621e2b5b14233cd41223c3b9f9590f896c11daee4df22d9bd3",
    size_mb: 64.0,
};

pub static KOKORO: Pack = Pack {
    id: "kokoro",
    kind: Kind::Kokoro,
    dir: "kokoro-multi-lang-v1_0",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2",
    sha256: "c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298",
    size_mb: 334.0,
};

/// Modelos de reconocimiento de voz (Whisper). El pequeño va mejor en computadoras modestas;
/// el turbo es el equilibrio por defecto cuando hay CPU de sobra.
pub static WHISPER_TURBO: Pack = Pack {
    id: "whisper-turbo",
    kind: Kind::Whisper,
    dir: "sherpa-onnx-whisper-turbo",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-turbo.tar.bz2",
    sha256: "b11acbbcd660b44a8e0df33724feb5aaa709cf65668f2823d59f656312544f22",
    size_mb: 538.0,
};

pub static WHISPER_SMALL: Pack = Pack {
    id: "whisper-small",
    kind: Kind::Whisper,
    dir: "sherpa-onnx-whisper-small",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2",
    sha256: "486a46afbb7ba798507190ffe02fea2dd726049af212e774537efac6afb210a6",
    size_mb: 610.0,
};

pub static STT_PACKS: [&Pack; 2] = [&WHISPER_TURBO, &WHISPER_SMALL];

pub fn find_stt_pack(id: &str) -> Option<&'static Pack> {
    STT_PACKS.iter().copied().find(|p| p.id == id)
}

pub static VOICES: [Voice; 8] = [
    Voice {
        id: "piper-claude",
        name: "Piper · Claude (México)",
        description: "Ligera y rápida, aun en computadoras modestas.",
        pack: &PIPER,
        sid: 0,
        lang: "es",
    },
    Voice {
        id: "piper-dave",
        name: "Piper · Dave (hombre)",
        description: "Voz de hombre con acento de España; ligera y rápida.",
        pack: &PIPER_DAVE,
        sid: 0,
        lang: "es",
    },
    Voice {
        id: "kokoro-dora",
        name: "Kokoro · Dora (mujer)",
        description: "Más expresiva y natural; el modelo es más grande.",
        pack: &KOKORO,
        sid: 28,
        lang: "es",
    },
    Voice {
        id: "kokoro-alex",
        name: "Kokoro · Alex (hombre)",
        description: "Más expresiva y natural; comparte el modelo con Dora.",
        pack: &KOKORO,
        sid: 29,
        lang: "es",
    },
    Voice {
        id: "piper-lessac",
        name: "Piper · Lessac (US)",
        description: "Light and fast, even on modest computers.",
        pack: &PIPER_EN,
        sid: 0,
        lang: "en",
    },
    Voice {
        id: "piper-joe",
        name: "Piper · Joe (male)",
        description: "Light and fast, even on modest computers.",
        pack: &PIPER_JOE,
        sid: 0,
        lang: "en",
    },
    Voice {
        id: "kokoro-heart",
        name: "Kokoro · Heart (female)",
        description: "More expressive and natural; the model is larger.",
        pack: &KOKORO,
        sid: 3,
        lang: "en",
    },
    Voice {
        id: "kokoro-michael",
        name: "Kokoro · Michael (male)",
        description: "More expressive and natural; shares the model with Heart.",
        pack: &KOKORO,
        sid: 16,
        lang: "en",
    },
];

pub fn find_voice(id: &str) -> Option<&'static Voice> {
    VOICES.iter().find(|v| v.id == id)
}

pub fn find_pack(id: &str) -> Option<&'static Pack> {
    [&PIPER, &PIPER_DAVE, &PIPER_EN, &PIPER_JOE, &KOKORO].into_iter().find(|p| p.id == id)
}

pub fn pack_path(voices_dir: &Path, pack: &Pack) -> PathBuf {
    voices_dir.join(pack.dir)
}

/// Un paquete esta completo si tiene al menos un `.onnx` y su `tokens.txt`
/// (Whisper los nombra `<prefijo>-tokens.txt`).
pub fn has_model_files(dir: &Path) -> bool {
    if !dir.is_dir() {
        return false;
    }
    let mut onnx = false;
    let mut tokens = false;
    for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "onnx") {
            onnx = true;
        }
        if path.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.ends_with("tokens.txt")) {
            tokens = true;
        }
        if onnx && tokens {
            return true;
        }
    }
    false
}

/// El paquete esta completo: se extrae en una carpeta temporal y se renombra al final
pub fn is_installed(voices_dir: &Path, pack: &Pack) -> bool {
    has_model_files(&pack_path(voices_dir, pack))
}

#[derive(Debug, Clone, Serialize)]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_mb: f64,
    /// "es" o "en"
    pub lang: String,
    pub is_downloaded: bool,
    pub is_downloading: bool,
    /// 0-100
    pub download_progress: f64,
}

/// Maximo de texto por llamada: un paso de la pizarra es corto
pub const MAX_TEXT_CHARS: usize = 2000;

/// WAV de 16 bits, mono, listo para un <audio> del navegador
pub fn wav_bytes(samples: &[f32], sample_rate: i32) -> Vec<u8> {
    let data_len = (samples.len() * 2) as u32;
    let mut out = Vec::with_capacity(44 + samples.len() * 2);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&(sample_rate as u32).to_le_bytes());
    out.extend_from_slice(&((sample_rate as u32) * 2).to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        out.extend_from_slice(&((s.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
    }
    out
}
