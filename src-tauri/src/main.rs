#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod models;
mod types;

use ai::AIEngine;
use models::ModelManager;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_store::StoreExt;
use types::{AIProvider, AppSettings};

struct AppState {
    ai: Mutex<AIEngine>,
    models: Mutex<ModelManager>,
    settings: Mutex<AppSettings>,
}

fn main() {
    env_logger::init();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            ai: Mutex::new(AIEngine::new()),
            models: Mutex::new(ModelManager::new()),
            settings: Mutex::new(AppSettings {
                provider: AIProvider::Local,
                openai_key: String::new(),
                anthropic_key: String::new(),
                active_model_id: None,
            }),
        })
        .setup(|app| {
            // Igual que Handy: los modelos viven en <app_data_dir>/models
            if let Ok(dir) = app.path().app_data_dir() {
                let state = app.state::<AppState>();
                let result = state.models.lock().unwrap().set_models_dir(dir.join("models"));
                if let Err(e) = result {
                    eprintln!("No se pudo crear el directorio de modelos: {}", e);
                }
            }
            if let Ok(config) = app.store("settings.json") {
                if let Some(provider_val) = config.get("provider") {
                    let provider = match provider_val.as_str() {
                        Some("openai") => AIProvider::OpenAI,
                        Some("anthropic") => AIProvider::Anthropic,
                        _ => AIProvider::Local,
                    };
                    
                    let openai_key = config.get("openai_key")
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                        .unwrap_or_default();
                    
                    let anthropic_key = config.get("anthropic_key")
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                        .unwrap_or_default();
                    
                    let active_model_id = config.get("active_model_id")
                        .and_then(|v| v.as_str().map(String::from));
                    
                    let state = app.state::<AppState>();
                    {
                        let mut settings = state.settings.lock().unwrap();
                        settings.provider = provider;
                        settings.openai_key = openai_key;
                        settings.anthropic_key = anthropic_key;
                        settings.active_model_id = active_model_id.clone();
                    }
                    
                    state.models.lock().unwrap().restore_active_model(active_model_id);

                    {
                        let mut ai = state.ai.lock().unwrap();
                        let settings = state.settings.lock().unwrap();
                        ai.configure(&settings);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // AI
            ai::commands::solve_problem,
            // Models
            models::commands::list_models,
            models::commands::download_model,
            models::commands::pause_download,
            models::commands::resume_download,
            models::commands::cancel_download,
            models::commands::get_download_progress,
            models::commands::select_model,
            models::commands::delete_model,
            // Settings
            ai::commands::get_settings,
            ai::commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
