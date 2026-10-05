use tauri::Manager;
use tauri_plugin_store::StoreExt;
use crate::types::ModelInfo;

#[tauri::command]
pub fn list_models(app: tauri::AppHandle) -> Result<Vec<ModelInfo>, String> {
    let state = app.state::<crate::AppState>();
    let mut models = state.models.lock().map_err(|e| e.to_string())?;
    Ok(models.list_models())
}

#[tauri::command]
pub async fn download_model(app: tauri::AppHandle, model_id: String) -> Result<(), String> {
    let state = app.state::<crate::AppState>();
    let models = state.models.lock().map_err(|e| e.to_string())?;
    
    // Start async download
    models.download_model_async(&model_id, app.clone())
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn pause_download(app: tauri::AppHandle, model_id: String) -> Result<(), String> {
    let state = app.state::<crate::AppState>();
    let models = state.models.lock().map_err(|e| e.to_string())?;
    models.pause_download(&model_id);
    Ok(())
}

#[tauri::command]
pub fn resume_download(app: tauri::AppHandle, model_id: String) -> Result<(), String> {
    let state = app.state::<crate::AppState>();
    let models = state.models.lock().map_err(|e| e.to_string())?;
    models.resume_download(&model_id);
    Ok(())
}

#[tauri::command]
pub fn cancel_download(app: tauri::AppHandle, model_id: String) -> Result<bool, String> {
    let state = app.state::<crate::AppState>();
    let models = state.models.lock().map_err(|e| e.to_string())?;
    Ok(models.cancel_download(&model_id))
}

#[tauri::command]
pub fn get_download_progress(app: tauri::AppHandle, model_id: String) -> Result<Option<f64>, String> {
    let state = app.state::<crate::AppState>();
    let models = state.models.lock().map_err(|e| e.to_string())?;
    Ok(models.get_download_progress(&model_id))
}

#[tauri::command]
pub fn select_model(app: tauri::AppHandle, model_id: String) -> Result<(), String> {
    let state = app.state::<crate::AppState>();
    let mut models = state.models.lock().map_err(|e| e.to_string())?;
    models.select_model(&model_id).map_err(|e| e.to_string())?;
    // Como Handy: el modelo activo se carga en memoria en segundo plano
    if let Some(files) = models.get_active_local_model() {
        crate::ai::local::preload(files);
    }
    
    // Update settings with active model
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.active_model_id = Some(model_id);

    // Propagar al motor de IA y persistir para que sobreviva al reinicio
    let mut ai = state.ai.lock().map_err(|e| e.to_string())?;
    ai.configure(&settings);
    if let Ok(store) = app.store("settings.json") {
        store.set("active_model_id", serde_json::json!(settings.active_model_id));
        let _ = store.save();
    }

    Ok(())
}

#[tauri::command]
pub fn delete_model(app: tauri::AppHandle, model_id: String) -> Result<(), String> {
    let state = app.state::<crate::AppState>();
    let mut models = state.models.lock().map_err(|e| e.to_string())?;
    if models.get_active_model().map(|m| m.id.as_str()) == Some(model_id.as_str()) {
        crate::ai::local::unload(); // soltar el archivo antes de borrarlo
    }
    models.delete_model(&model_id).map_err(|e| e.to_string())?;

    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    if settings.active_model_id.as_deref() == Some(model_id.as_str()) {
        settings.active_model_id = None;
        let mut ai = state.ai.lock().map_err(|e| e.to_string())?;
        ai.configure(&settings);
        if let Ok(store) = app.store("settings.json") {
            store.set("active_model_id", serde_json::json!(settings.active_model_id));
            let _ = store.save();
        }
    }
    Ok(())
}
