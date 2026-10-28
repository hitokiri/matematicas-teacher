use anyhow::{anyhow, Result};
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

use super::{is_installed, pack_path, Pack};

pub struct Download {
    /// 0-100
    pub progress: AtomicI32,
    pub cancelled: AtomicBool,
}

/// Descargas en curso por paquete
static DOWNLOADS: Mutex<Option<HashMap<&'static str, Arc<Download>>>> = Mutex::new(None);

pub fn progress_of(pack: &Pack) -> Option<f64> {
    let map = DOWNLOADS.lock().ok()?;
    let d = map.as_ref()?.get(pack.id)?;
    Some(d.progress.load(Ordering::Relaxed) as f64)
}

pub fn cancel(pack: &Pack) {
    if let Some(d) = DOWNLOADS.lock().ok().and_then(|m| m.as_ref()?.get(pack.id).cloned()) {
        d.cancelled.store(true, Ordering::Relaxed);
    }
}

fn finish(pack: &Pack) {
    if let Ok(mut map) = DOWNLOADS.lock() {
        if let Some(m) = map.as_mut() {
            m.remove(pack.id);
        }
    }
}

/// Empieza la descarga en segundo plano; emite `voice-download-progress`, `voice-download-error`
/// y `voices-updated`.
pub fn start(app: AppHandle, voices_dir: PathBuf, pack: &'static Pack) -> Result<()> {
    if is_installed(&voices_dir, pack) {
        return Ok(());
    }
    let dl = Arc::new(Download { progress: AtomicI32::new(0), cancelled: AtomicBool::new(false) });
    {
        let mut map = DOWNLOADS.lock().map_err(|_| anyhow!("estado de descargas daniado"))?;
        let map = map.get_or_insert_with(HashMap::new);
        if map.contains_key(pack.id) {
            return Ok(()); // ya se esta descargando
        }
        map.insert(pack.id, dl.clone());
    }
    log::info!("Descargando la voz «{}» ({} MB)", pack.id, pack.size_mb);
    tauri::async_runtime::spawn(async move {
        let result = run(&app, &voices_dir, pack, &dl).await;
        finish(pack);
        match &result {
            Ok(()) => log::info!("Voz «{}» descargada e instalada", pack.id),
            Err(e) if dl.cancelled.load(Ordering::Relaxed) => log::info!("Descarga de la voz «{}» cancelada", pack.id),
            Err(e) => log::error!("No se pudo descargar la voz «{}»: {}", pack.id, e),
        }
        if let Err(e) = result {
            if !dl.cancelled.load(Ordering::Relaxed) {
                let _ = app.emit("voice-download-error", serde_json::json!({ "pack": pack.id, "message": e.to_string() }));
            }
        }
        let _ = app.emit("voices-updated", ());
    });
    Ok(())
}

async fn run(app: &AppHandle, voices_dir: &Path, pack: &'static Pack, dl: &Download) -> Result<()> {
    std::fs::create_dir_all(voices_dir)?;
    let part = voices_dir.join(format!("{}.tar.bz2.part", pack.id));
    let result = fetch_and_install(app, voices_dir, pack, dl, &part).await;
    let _ = std::fs::remove_file(&part);
    let _ = std::fs::remove_dir_all(voices_dir.join(format!(".tmp-{}", pack.id)));
    result
}

async fn fetch_and_install(app: &AppHandle, voices_dir: &Path, pack: &'static Pack, dl: &Download, part: &Path) -> Result<()> {
    // Solo HTTPS, y el archivo debe coincidir con el SHA-256 fijado en el codigo
    let resp = reqwest::get(pack.url).await?.error_for_status()?;
    let total = resp.content_length().unwrap_or((pack.size_mb * 1_048_576.0) as u64).max(1);
    let mut file = std::fs::File::create(part)?;
    let mut hasher = Sha256::new();
    let mut done: u64 = 0;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if dl.cancelled.load(Ordering::Relaxed) {
            return Err(anyhow!("Descarga cancelada"));
        }
        let chunk = chunk?;
        hasher.update(&chunk);
        file.write_all(&chunk)?;
        done += chunk.len() as u64;
        let pct = ((done as f64 / total as f64) * 95.0).min(95.0) as i32;
        if pct != dl.progress.swap(pct, Ordering::Relaxed) {
            let _ = app.emit("voice-download-progress", serde_json::json!({ "pack": pack.id, "progress": pct }));
        }
    }
    file.flush()?;
    drop(file);
    let digest: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
    if digest != pack.sha256 {
        return Err(anyhow!("El archivo descargado no coincide con el esperado; se descartó"));
    }

    let (part, voices_dir_owned, tmp_name) = (part.to_path_buf(), voices_dir.to_path_buf(), format!(".tmp-{}", pack.id));
    tauri::async_runtime::spawn_blocking(move || extract(&part, &voices_dir_owned, &tmp_name, pack)).await??;
    dl.progress.store(100, Ordering::Relaxed);
    let _ = app.emit("voice-download-progress", serde_json::json!({ "pack": pack.id, "progress": 100 }));
    Ok(())
}

/// Extrae en una carpeta temporal (tar rechaza rutas con `..` o absolutas) y la renombra al final,
/// asi un paquete a medias nunca parece instalado.
fn extract(archive: &Path, voices_dir: &Path, tmp_name: &str, pack: &Pack) -> Result<()> {
    let tmp = voices_dir.join(tmp_name);
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp)?;
    let decoder = bzip2::read::BzDecoder::new(std::fs::File::open(archive)?);
    let mut tar = tar::Archive::new(decoder);
    tar.set_preserve_permissions(false);
    tar.set_unpack_xattrs(false);
    tar.unpack(&tmp)?;
    let extracted = tmp.join(pack.dir);
    if !super::has_model_files(&extracted) {
        return Err(anyhow!("El paquete descargado no trae los archivos esperados"));
    }
    let dest = pack_path(voices_dir, pack);
    let _ = std::fs::remove_dir_all(&dest);
    std::fs::rename(&extracted, &dest)?;
    let _ = std::fs::remove_dir_all(&tmp);
    Ok(())
}
