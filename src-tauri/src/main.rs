#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod applog;
mod models;
mod types;
mod voice;

use ai::AIEngine;
use models::ModelManager;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_store::StoreExt;
use types::AppSettings;

struct AppState {
    ai: Mutex<AIEngine>,
    models: Mutex<ModelManager>,
    settings: Mutex<AppSettings>,
}

fn main() {
    applog::init();

    // WebKitGTK 4.1 con GPU NVIDIA aborta con "Could not create GBM EGL display: EGL_NOT_INITIALIZED".
    // Sin el renderizador DMA-BUF la ventana usa el camino normal de EGL. Se puede seguir
    // controlando con la variable de entorno si alguien la pone a mano.
    #[cfg(target_os = "linux")]
    if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState {
            ai: Mutex::new(AIEngine::new()),
            models: Mutex::new(ModelManager::new()),
            settings: Mutex::new(AppSettings { active_model_id: None }),
        })
        .setup(|app| {
            // Igual que Handy: los modelos viven en <app_data_dir>/models
            if let Ok(dir) = app.path().app_data_dir() {
                applog::set_dir(dir.join("logs"));
                applog::set_header(format!(
                    "Matemáticas Teacher {} · {} {}",
                    env!("CARGO_PKG_VERSION"),
                    std::env::consts::OS,
                    std::env::consts::ARCH
                ));
                log::info!("La app arrancó (versión {})", env!("CARGO_PKG_VERSION"));
                let state = app.state::<AppState>();
                let result = state.models.lock().unwrap().set_models_dir(dir.join("models"));
                if let Err(e) = result {
                    log::error!("No se pudo crear el directorio de modelos: {}", e);
                }
            }
            if let Ok(config) = app.store("settings.json") {
                let active_model_id = config.get("active_model_id")
                    .and_then(|v| v.as_str().map(String::from));
                let speeds: std::collections::HashMap<String, f64> = config.get("model_speeds")
                    .and_then(|v| serde_json::from_value(v).ok())
                    .unwrap_or_default();

                let state = app.state::<AppState>();
                let mut models = state.models.lock().unwrap();
                models.set_speeds(speeds);
                models.restore_active_model(active_model_id);
                let mut settings = state.settings.lock().unwrap();
                settings.active_model_id = models.get_active_model().map(|m| m.id.clone());
                state.ai.lock().unwrap().configure(&settings);
                // Como Handy: el modelo activo se carga en memoria al arrancar
                if let Some(files) = models.get_active_local_model() {
                    ai::local::preload(files);
                }
            }

            // Detectar GPU/RAM en segundo plano para recomendar el modelo que mejor cabe
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let (gpu, ram) = ai::local::hardware_mb();
                log::info!(
                    "Hardware: GPU {} · RAM {:.0} MB",
                    gpu.map(|g| format!("{g:.0} MB de VRAM")).unwrap_or_else(|| "no detectada".into()),
                    ram
                );
                handle.state::<AppState>().models.lock().unwrap().set_hardware(gpu, ram);
                let _ = tauri::Emitter::emit(&handle, "models-updated", ());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // AI
            ai::commands::solve_problem,
            ai::commands::read_problem,
            ai::commands::ask_about_steps,
            // Models
            models::commands::list_models,
            models::commands::download_model,
            models::commands::pause_download,
            models::commands::resume_download,
            models::commands::cancel_download,
            models::commands::get_download_progress,
            models::commands::select_model,
            models::commands::delete_model,
            // Voice
            voice::commands::list_voices,
            voice::commands::download_voice,
            voice::commands::cancel_voice_download,
            voice::commands::delete_voice,
            voice::commands::synthesize_speech,
            // Registro
            applog::get_logs,
            applog::clear_logs,
            applog::log_from_ui,
            // Settings
            ai::commands::get_settings,
            ai::commands::get_compute_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
