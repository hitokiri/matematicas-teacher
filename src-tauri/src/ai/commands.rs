use tauri::Manager;
use tauri_plugin_store::StoreExt;
use crate::types::{AIProvider, AppSettings, MathProblem};

#[tauri::command]
pub async fn solve_problem(app: tauri::AppHandle, problem_text: String, problem_image: Option<String>) -> Result<serde_json::Value, String> {
    let state = app.state::<crate::AppState>();
    
    // Clone settings to avoid holding MutexGuard across await
    let settings = {
        let settings = state.settings.lock().map_err(|e| e.to_string())?;
        settings.clone()
    };
    
    let problem = MathProblem { text: problem_text, image: problem_image.filter(|i| !i.is_empty()) };
    let solution = crate::ai::engine::AIEngine::solve_with_settings(&problem, &settings)
        .await
        .map_err(|e| e.to_string())?;
    
    serde_json::to_value(&solution).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let state = app.state::<crate::AppState>();
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn save_settings(
    app: tauri::AppHandle,
    provider: String,
    openai_key: String,
    anthropic_key: String,
    active_model_id: Option<String>,
) -> Result<(), String> {
    let state = app.state::<crate::AppState>();
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    
    settings.provider = match provider.as_str() {
        "openai" => AIProvider::OpenAI,
        "anthropic" => AIProvider::Anthropic,
        _ => AIProvider::Local,
    };
    settings.openai_key = openai_key;
    settings.anthropic_key = anthropic_key;
    settings.active_model_id = active_model_id.clone();
    
    let mut ai = state.ai.lock().map_err(|e| e.to_string())?;
    ai.configure(&settings);
    
    if let Ok(store) = app.store("settings.json") {
        let _ = store.set("provider", serde_json::json!(match &settings.provider {
            AIProvider::Local => "local",
            AIProvider::OpenAI => "openai",
            AIProvider::Anthropic => "anthropic",
        }));
        let _ = store.set("openai_key", serde_json::json!(settings.openai_key));
        let _ = store.set("anthropic_key", serde_json::json!(settings.anthropic_key));
        let _ = store.set("active_model_id", serde_json::json!(settings.active_model_id));
        let _ = store.save();
    }
    
    Ok(())
}
