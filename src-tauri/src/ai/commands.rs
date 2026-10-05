use tauri::Manager;
use tauri_plugin_store::StoreExt;
use crate::types::{AppSettings, MathProblem};

#[tauri::command]
pub async fn solve_problem(app: tauri::AppHandle, problem_text: String, problem_image: Option<String>) -> Result<serde_json::Value, String> {
    let state = app.state::<crate::AppState>();
    
    // Clone settings to avoid holding MutexGuard across await
    let settings = {
        let settings = state.settings.lock().map_err(|e| e.to_string())?;
        settings.clone()
    };
    
    // Archivos del modelo activo (si esta descargado)
    let local_model = {
        let mut models = state.models.lock().map_err(|e| e.to_string())?;
        models.refresh_download_status();
        models.get_active_local_model()
    };

    let problem = MathProblem { text: problem_text, image: problem_image.filter(|i| !i.is_empty()) };
    let solution = crate::ai::engine::AIEngine::solve_with_settings(&problem, &settings, local_model)
        .await
        .map_err(|e| e.to_string())?;

    // Guardar la velocidad medida en esta PC para mostrarla en la lista de modelos
    if let (Some(tps), Some(model_id)) = (crate::ai::local::take_last_speed(), &settings.active_model_id) {
        let mut models = state.models.lock().map_err(|e| e.to_string())?;
        let speeds = models.record_speed(model_id, tps);
        if let Ok(store) = app.store("settings.json") {
            store.set("model_speeds", serde_json::json!(speeds));
            let _ = store.save();
        }
        let _ = tauri::Emitter::emit(&app, "models-updated", ());
    }
    
    serde_json::to_value(&solution).map_err(|e| e.to_string())
}

/// Hardware que usa el modelo local ("GPU: ..." o "CPU")
#[tauri::command]
pub async fn get_compute_device() -> Result<String, String> {
    tokio::task::spawn_blocking(crate::ai::local::compute_device)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let state = app.state::<crate::AppState>();
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}
