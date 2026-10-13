//! Registro de la app: lo que pasa se guarda en memoria (para verlo en Configuración) y en un
//! archivo (por si la app no llega a abrir). Sirve para que, cuando algo falle, el usuario
//! sepa qué fue. No se registra el texto de los problemas ni los dibujos.

use log::{Level, LevelFilter, Log, Metadata, Record};
use serde::Serialize;
use std::collections::VecDeque;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

/// Entradas que se guardan en memoria
const CAPACITY: usize = 500;
/// Tamano del archivo antes de pasar al anterior (`app.log.1`)
const MAX_FILE_BYTES: u64 = 512 * 1024;
/// Largo maximo de un mensaje
const MAX_MESSAGE_CHARS: usize = 1_000;

#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    /// Hora local "2026-10-13 17:20:01"
    pub time: String,
    /// "ERROR", "WARN", "INFO"...
    pub level: String,
    /// De qué parte viene ("voz", "modelos", "pantalla"...)
    pub source: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LogSnapshot {
    /// Versión, sistema y hardware, para pegar al reportar un problema
    pub header: String,
    /// Dónde está el archivo del registro (vacío si no se pudo crear)
    pub file: String,
    pub entries: Vec<LogEntry>,
}

struct State {
    entries: VecDeque<LogEntry>,
    file: Option<PathBuf>,
    header: String,
}

static STATE: Mutex<State> = Mutex::new(State { entries: VecDeque::new(), file: None, header: String::new() });

struct AppLogger {
    inner: env_logger::Logger,
}

impl Log for AppLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        self.inner.enabled(metadata)
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        self.inner.log(record); // sigue saliendo por la terminal
        push(record.level(), record.target(), &record.args().to_string());
    }

    fn flush(&self) {
        self.inner.flush();
    }
}

/// Instala el registro. Por defecto: avisos y errores de todo, e información de la app.
/// `RUST_LOG` lo sigue controlando.
pub fn init() {
    let mut builder = env_logger::Builder::new();
    builder.filter_level(LevelFilter::Warn).filter_module(env!("CARGO_PKG_NAME").replace('-', "_").as_str(), LevelFilter::Info);
    if let Ok(spec) = std::env::var("RUST_LOG") {
        builder.parse_filters(&spec);
    }
    let inner = builder.build();
    log::set_max_level(inner.filter());
    let _ = log::set_boxed_logger(Box::new(AppLogger { inner }));
}

/// Dónde se guarda el archivo; se llama cuando se conoce la carpeta de datos de la app
pub fn set_dir(dir: PathBuf) {
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(mut s) = STATE.lock() {
        s.file = Some(dir.join("app.log"));
    }
}

pub fn set_header(header: String) {
    if let Ok(mut s) = STATE.lock() {
        s.header = header;
    }
}

/// Texto de una sola linea, sin caracteres de control, de largo acotado
fn clean(text: &str, max: usize) -> String {
    let flat: String = text.chars().map(|c| if c.is_control() { ' ' } else { c }).collect();
    let flat = flat.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > max {
        format!("{}…", flat.chars().take(max).collect::<String>())
    } else {
        flat
    }
}

/// Nombre corto y entendible de la parte de la app que escribió el mensaje
fn source_of(target: &str) -> String {
    let t = target.trim_start_matches("matematicas_teacher::");
    let name = match t.split("::").next().unwrap_or(t) {
        "voice" => "voz",
        "models" => "modelos",
        "ai" => "modelo de IA",
        "matematicas_teacher" | "main" => "app",
        other => other,
    };
    name.to_string()
}

pub fn push(level: Level, target: &str, message: &str) {
    let entry = LogEntry {
        time: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        level: level.to_string(),
        source: if target.starts_with("front:") { target[6..].to_string() } else { source_of(target) },
        message: clean(message, MAX_MESSAGE_CHARS),
    };
    let Ok(mut s) = STATE.lock() else { return };
    if let Some(path) = s.file.clone() {
        append(&path, &entry);
    }
    if s.entries.len() == CAPACITY {
        s.entries.pop_front();
    }
    s.entries.push_back(entry);
}

fn append(path: &PathBuf, e: &LogEntry) {
    if std::fs::metadata(path).map(|m| m.len() > MAX_FILE_BYTES).unwrap_or(false) {
        let _ = std::fs::rename(path, path.with_extension("log.1"));
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{} [{}] {}: {}", e.time, e.level, e.source, e.message);
    }
}

pub fn snapshot() -> LogSnapshot {
    let s = STATE.lock().unwrap_or_else(|e| e.into_inner());
    LogSnapshot {
        header: s.header.clone(),
        file: s.file.as_ref().map(|p| p.display().to_string()).unwrap_or_default(),
        entries: s.entries.iter().cloned().collect(),
    }
}

pub fn clear() {
    if let Ok(mut s) = STATE.lock() {
        s.entries.clear();
    }
}

/// Mensajes que manda la pantalla (errores que el usuario vio, fallos de la interfaz)
#[tauri::command]
pub fn log_from_ui(level: String, source: String, message: String) {
    let level = match level.as_str() {
        "error" => Level::Error,
        "warn" => Level::Warn,
        _ => Level::Info,
    };
    let source = clean(&source, 30);
    push(level, &format!("front:{}", if source.is_empty() { "pantalla" } else { &source }), &message);
}

#[tauri::command]
pub fn get_logs() -> LogSnapshot {
    snapshot()
}

#[tauri::command]
pub fn clear_logs() {
    clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limpia_saltos_de_linea_y_acota_el_largo() {
        assert_eq!(clean("uno\ndos\t tres\u{7}", 100), "uno dos tres");
        let largo = clean(&"a".repeat(5000), 10);
        assert_eq!(largo.chars().count(), 11); // 10 + "…"
    }

    #[test]
    fn nombra_la_parte_de_la_app() {
        assert_eq!(source_of("matematicas_teacher::voice::download"), "voz");
        assert_eq!(source_of("matematicas_teacher::models::manager"), "modelos");
        assert_eq!(source_of("matematicas_teacher"), "app");
        assert_eq!(source_of("hyper::client"), "hyper");
    }

    #[test]
    fn el_buffer_no_pasa_de_su_capacidad_y_conserva_lo_ultimo() {
        clear();
        for i in 0..(CAPACITY + 20) {
            push(Level::Info, "matematicas_teacher", &format!("mensaje {i}"));
        }
        let snap = snapshot();
        assert_eq!(snap.entries.len(), CAPACITY);
        assert_eq!(snap.entries.last().unwrap().message, format!("mensaje {}", CAPACITY + 19));
        assert_eq!(snap.entries.first().unwrap().message, "mensaje 20");
        clear();
    }

    #[test]
    fn la_pantalla_puede_registrar_con_su_propio_origen() {
        clear();
        log_from_ui("error".into(), "voz".into(), "No se pudo\nreproducir".into());
        let e = snapshot().entries.pop().unwrap();
        assert_eq!((e.level.as_str(), e.source.as_str(), e.message.as_str()), ("ERROR", "voz", "No se pudo reproducir"));
        clear();
    }

    #[test]
    fn escribe_el_archivo_y_pasa_al_anterior_cuando_crece() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.log");
        let e = LogEntry { time: "t".into(), level: "INFO".into(), source: "app".into(), message: "hola".into() };
        append(&path, &e);
        assert!(std::fs::read_to_string(&path).unwrap().contains("[INFO] app: hola"));
        std::fs::write(&path, vec![b'x'; (MAX_FILE_BYTES + 1) as usize]).unwrap();
        append(&path, &e);
        assert!(dir.path().join("app.log.1").exists());
        assert!(std::fs::metadata(&path).unwrap().len() < 100);
    }
}
