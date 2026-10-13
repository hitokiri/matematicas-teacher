//! Voz del sistema: se usa `espeak-ng` directamente (en Linux). El WebKitGTK de varias distribuciones
//! (p. ej. Ubuntu 24.04) se compila sin voz, así que `speechSynthesis` del navegador no existe
//! aunque el sistema tenga speech-dispatcher y espeak-ng instalados.

use anyhow::{anyhow, Result};
use serde::Serialize;
use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use super::{wav_bytes, MAX_TEXT_CHARS};

/// Programas de voz que se buscan, en orden
const ENGINES: [&str; 2] = ["espeak-ng", "espeak"];
/// Cuanto se espera a que el programa termine
const TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Serialize)]
pub struct SystemVoiceInfo {
    pub available: bool,
    /// Programa encontrado ("espeak-ng")
    pub engine: Option<String>,
    /// Sistema operativo para mostrarlo ("Ubuntu 24.04.5 LTS")
    pub os: String,
    /// Comando para instalar lo que falta (si se conoce la distribución)
    pub install_command: Option<String>,
}

fn works(bin: &str) -> bool {
    Command::new(bin)
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

pub fn find_engine() -> Option<&'static str> {
    ENGINES.into_iter().find(|b| works(b))
}

/// (id, ids parecidos, nombre bonito) de un /etc/os-release
pub fn parse_os_release(text: &str) -> (String, Vec<String>, String) {
    let get = |key: &str| {
        text.lines()
            .find_map(|l| l.strip_prefix(&format!("{key}=")))
            .map(|v| v.trim().trim_matches('"').to_string())
            .unwrap_or_default()
    };
    let like = get("ID_LIKE").split_whitespace().map(String::from).collect();
    (get("ID"), like, get("PRETTY_NAME"))
}

/// Comando que instala espeak-ng en esa distribución
pub fn install_command(id: &str, like: &[String]) -> Option<String> {
    let is = |names: &[&str]| names.iter().any(|n| id == *n || like.iter().any(|l| l == n));
    let cmd = if is(&["debian", "ubuntu"]) {
        "sudo apt install espeak-ng"
    } else if is(&["fedora", "rhel", "centos"]) {
        "sudo dnf install espeak-ng"
    } else if is(&["arch", "manjaro"]) {
        "sudo pacman -S espeak-ng"
    } else if is(&["opensuse", "suse"]) {
        "sudo zypper install espeak-ng"
    } else if is(&["alpine"]) {
        "sudo apk add espeak-ng"
    } else {
        return None;
    };
    Some(cmd.to_string())
}

pub fn info() -> SystemVoiceInfo {
    let engine = find_engine().map(String::from);
    let release = std::fs::read_to_string("/etc/os-release").unwrap_or_default();
    let (id, like, pretty) = parse_os_release(&release);
    SystemVoiceInfo {
        available: engine.is_some(),
        install_command: if engine.is_some() { None } else { install_command(&id, &like) },
        os: if pretty.is_empty() { std::env::consts::OS.to_string() } else { pretty },
        engine,
    }
}

/// espeak escribe un WAV "de flujo" (tamaños 0x7ffff000); se lee el PCM y se vuelve a empaquetar bien
fn rewrap(wav: &[u8]) -> Result<Vec<u8>> {
    if wav.len() < 44 || &wav[0..4] != b"RIFF" || &wav[8..12] != b"WAVE" {
        return Err(anyhow!("El programa de voz no devolvió audio"));
    }
    let rate = u32::from_le_bytes(wav[24..28].try_into()?) as i32;
    let pcm = &wav[44..];
    let samples: Vec<f32> = pcm.chunks_exact(2).map(|b| i16::from_le_bytes([b[0], b[1]]) as f32 / 32768.0).collect();
    if samples.is_empty() {
        return Err(anyhow!("El programa de voz no devolvió audio"));
    }
    Ok(wav_bytes(&samples, rate))
}

/// Texto -> WAV con la voz del sistema (bloqueante)
pub fn synthesize(text: &str) -> Result<Vec<u8>> {
    let text = text.trim();
    if text.is_empty() {
        return Err(anyhow!("No hay texto para leer"));
    }
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err(anyhow!("El texto es demasiado largo para leerlo"));
    }
    let bin = find_engine().ok_or_else(|| anyhow!("No hay una voz del sistema instalada (falta espeak-ng)"))?;
    let mut child = Command::new(bin)
        // el texto va como argumento (sin shell) tras `--`, asi un texto que empiece con "-" no es una opcion
        .args(["-v", "es-419", "-s", "155", "--stdout", "--"])
        .arg(text)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let mut stdout = child.stdout.take().ok_or_else(|| anyhow!("sin salida"))?;
    let reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stdout.read_to_end(&mut buf);
        buf
    });
    let started = Instant::now();
    loop {
        match child.try_wait()? {
            Some(status) if status.success() => break,
            Some(status) => return Err(anyhow!("El programa de voz terminó con error ({status})")),
            None if started.elapsed() > TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(anyhow!("El programa de voz tardó demasiado"));
            }
            None => std::thread::sleep(Duration::from_millis(20)),
        }
    }
    let wav = reader.join().map_err(|_| anyhow!("falló la lectura del audio"))?;
    rewrap(&wav)
}
