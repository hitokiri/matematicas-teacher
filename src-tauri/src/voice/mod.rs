//! Voz natural de la maestra: sintesis de voz local (sin internet) con sherpa-onnx.
//! Dos familias de voz, que el usuario descarga a pedido: Piper (ligera) y Kokoro (mas expresiva).

pub mod commands;
pub mod download;
pub mod engine;
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

pub static KOKORO: Pack = Pack {
    id: "kokoro",
    kind: Kind::Kokoro,
    dir: "kokoro-multi-lang-v1_0",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2",
    sha256: "c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298",
    size_mb: 334.0,
};

pub static VOICES: [Voice; 6] = [
    Voice {
        id: "piper-claude",
        name: "Piper · Claude (México)",
        description: "Ligera y rápida, aun en computadoras modestas.",
        pack: &PIPER,
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
    [&PIPER, &PIPER_EN, &KOKORO].into_iter().find(|p| p.id == id)
}

pub fn pack_path(voices_dir: &Path, pack: &Pack) -> PathBuf {
    voices_dir.join(pack.dir)
}

/// El paquete esta completo: se extrae en una carpeta temporal y se renombra al final
pub fn is_installed(voices_dir: &Path, pack: &Pack) -> bool {
    pack_path(voices_dir, pack).join("tokens.txt").is_file()
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
