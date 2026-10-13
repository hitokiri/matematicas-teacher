use tauri::Manager;

use super::{download, engine, find_voice, is_installed, VoiceInfo, MAX_TEXT_CHARS, VOICES};

fn voices_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("voices")).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_voices(app: tauri::AppHandle) -> Result<Vec<VoiceInfo>, String> {
    let dir = voices_dir(&app)?;
    Ok(VOICES
        .iter()
        .map(|v| {
            let progress = download::progress_of(v.pack);
            VoiceInfo {
                id: v.id.into(),
                name: v.name.into(),
                description: v.description.into(),
                size_mb: v.pack.size_mb,
                is_downloaded: is_installed(&dir, v.pack),
                is_downloading: progress.is_some(),
                download_progress: progress.unwrap_or(0.0),
            }
        })
        .collect())
}

#[tauri::command]
pub fn download_voice(app: tauri::AppHandle, voice_id: String) -> Result<(), String> {
    let voice = find_voice(&voice_id).ok_or("Voz desconocida")?;
    download::start(app.clone(), voices_dir(&app)?, voice.pack).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_voice_download(voice_id: String) -> Result<(), String> {
    let voice = find_voice(&voice_id).ok_or("Voz desconocida")?;
    download::cancel(voice.pack);
    Ok(())
}

#[tauri::command]
pub fn delete_voice(app: tauri::AppHandle, voice_id: String) -> Result<(), String> {
    let voice = find_voice(&voice_id).ok_or("Voz desconocida")?;
    log::info!("Se elimina la voz «{}»", voice.pack.id);
    engine::unload(); // soltar los archivos antes de borrarlos
    let path = super::pack_path(&voices_dir(&app)?, voice.pack);
    if path.exists() {
        std::fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    }
    let _ = tauri::Emitter::emit(&app, "voices-updated", ());
    Ok(())
}

/// Audio (WAV) de lo que dice la maestra, como bytes crudos (sin pasar por JSON)
#[tauri::command]
pub async fn synthesize_speech(app: tauri::AppHandle, voice_id: String, text: String) -> Result<tauri::ipc::Response, String> {
    let voice = find_voice(&voice_id).ok_or("Voz desconocida")?;
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err("El texto es demasiado largo para leerlo".into());
    }
    let dir = voices_dir(&app)?;
    let wav = tauri::async_runtime::spawn_blocking(move || engine::synthesize(&dir, voice, &text))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| {
            log::warn!("No se pudo generar la voz «{}»: {}", voice.id, e);
            e.to_string()
        })?;
    Ok(tauri::ipc::Response::new(wav))
}
