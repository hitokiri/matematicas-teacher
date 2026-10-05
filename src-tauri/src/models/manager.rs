use anyhow::Result;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use tauri::{AppHandle, Emitter};

use crate::types::ModelInfo;

/// Gestor de descarga individual
struct DownloadHandle {
    /// 0-100, o -1 si hubo error
    progress: Arc<AtomicI32>,
    cancelled: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
}

/// ModelManager - Gestiona la descarga, listado y seleccion de modelos
/// Patron similar al ModelManager de Handy
pub struct ModelManager {
    /// Directorio de modelos (como Handy: <app_data_dir>/models, archivos planos)
    models_dir: PathBuf,
    /// Currently active model ID
    active_model_id: Option<String>,
    /// Known available models
    available_models: Vec<ModelInfo>,
    /// Tracking active downloads
    downloading: Mutex<HashSet<String>>,
    /// Download handles for pause/cancel
    download_handles: Mutex<std::collections::HashMap<String, DownloadHandle>>,
}

impl ModelManager {
    pub fn new() -> Self {
        // Get HuggingFace cache directory (mismo que Handy usa)
        // Valor por defecto; main.rs lo reemplaza con <app_data_dir>/models via set_models_dir
        let models_dir = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".to_string()))
            .join(".local/share/matematicas-teacher/models");

        Self {
            models_dir,
            active_model_id: None,
            available_models: Self::get_default_models(),
            downloading: Mutex::new(HashSet::new()),
            download_handles: Mutex::new(std::collections::HashMap::new()),
        }
    }

    /// Fija el directorio de modelos y lo crea si no existe
    pub fn set_models_dir(&mut self, dir: PathBuf) -> Result<()> {
        std::fs::create_dir_all(&dir)?;
        self.models_dir = dir;
        self.refresh_download_status();
        Ok(())
    }

    /// Lista de modelos disponibles predefinidos
    pub(crate) fn get_default_models() -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "Qwen/Qwen3-VL-4B-Instruct-GGUF".to_string(),
                name: "Qwen 3 VL 4B (lee dibujos)".to_string(),
                description: "Modelo con vision: lee problemas escritos a mano y los explica paso a paso".to_string(),
                filename: "Qwen3VL-4B-Instruct-Q4_K_M.gguf".to_string(),
                mmproj_filename: Some("mmproj-Qwen3VL-4B-Instruct-Q8_0.gguf".to_string()),
                size_mb: 2950.0,
                is_downloaded: false,
                is_downloading: false,
                download_progress: 0.0,
                is_active: false,
                recommended_for: vec!["dibujos".to_string(), "matematicas".to_string(), "ecuaciones".to_string()],
                tags: vec!["imagenes".to_string(), "4B".to_string(), "Q4".to_string()],
            },
            ModelInfo {
                id: "ggml-org/Qwen2.5-VL-3B-Instruct-GGUF".to_string(),
                name: "Qwen 2.5 VL 3B (lee dibujos)".to_string(),
                description: "Modelo con vision mas ligero: lee problemas dibujados".to_string(),
                filename: "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf".to_string(),
                mmproj_filename: Some("mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf".to_string()),
                size_mb: 2775.0,
                is_downloaded: false,
                is_downloading: false,
                download_progress: 0.0,
                is_active: false,
                recommended_for: vec!["dibujos".to_string(), "aritmetica".to_string(), "pc-ligero".to_string()],
                tags: vec!["imagenes".to_string(), "3B".to_string(), "Q4".to_string()],
            },
            ModelInfo {
                id: "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF".to_string(),
                name: "Llama 3.1 8B Instruct".to_string(),
                description: "Modelo de Meta con excelente capacidad de razonamiento matematico".to_string(),
                filename: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf".to_string(),
                mmproj_filename: None,
                size_mb: 4915.0,
                is_downloaded: false,
                is_downloading: false,
                download_progress: 0.0,
                is_active: false,
                recommended_for: vec!["matematicas".to_string(), "logica".to_string(), "general".to_string()],
                tags: vec!["poderoso".to_string(), "8B".to_string(), "Q4".to_string()],
            },
            ModelInfo {
                id: "bartowski/Qwen2.5-3B-Instruct-GGUF".to_string(),
                name: "Qwen 2.5 3B Instruct".to_string(),
                description: "Modelo de Alibaba eficiente, ideal para aritmetica basica".to_string(),
                filename: "Qwen2.5-3B-Instruct-Q4_K_M.gguf".to_string(),
                mmproj_filename: None,
                size_mb: 2048.0,
                is_downloaded: false,
                is_downloading: false,
                download_progress: 0.0,
                is_active: false,
                recommended_for: vec!["aritmetica".to_string(), "rapido".to_string(), "pc-ligero".to_string()],
                tags: vec!["eficiente".to_string(), "3B".to_string(), "Q4".to_string()],
            },
            ModelInfo {
                id: "lmstudio-community/Phi-3.5-mini-instruct-GGUF".to_string(),
                name: "Phi 3.5 Mini 3.8B (Microsoft)".to_string(),
                description: "Modelo pequeno de Microsoft con buen rendimiento en matematicas".to_string(),
                filename: "Phi-3.5-mini-instruct-Q4_K_M.gguf".to_string(),
                mmproj_filename: None,
                size_mb: 2304.0,
                is_downloaded: false,
                is_downloading: false,
                download_progress: 0.0,
                is_active: false,
                recommended_for: vec!["matematicas".to_string(), "ecuaciones".to_string(), "pc-ligero".to_string()],
                tags: vec!["microsoft".to_string(), "3.8B".to_string(), "Q4".to_string()],
            },
            ModelInfo {
                id: "bartowski/gemma-2-2b-it-GGUF".to_string(),
                name: "Gemma 2 2B IT (Google)".to_string(),
                description: "Modelo ligero de Google, perfecto para empezar con matematicas basicas".to_string(),
                filename: "gemma-2-2b-it-Q4_K_M.gguf".to_string(),
                mmproj_filename: None,
                size_mb: 1536.0,
                is_downloaded: false,
                is_downloading: false,
                download_progress: 0.0,
                is_active: false,
                recommended_for: vec!["principiante".to_string(), "aritmetica".to_string(), "pc-ligero".to_string()],
                tags: vec!["google".to_string(), "2B".to_string(), "ligero".to_string()],
            },
            ModelInfo {
                id: "lmstudio-community/Mistral-7B-Instruct-v0.3-GGUF".to_string(),
                name: "Mistral 7B Instruct v3".to_string(),
                description: "Modelo versatil con buen razonamiento para fracciones y ecuaciones".to_string(),
                filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf".to_string(),
                mmproj_filename: None,
                size_mb: 4096.0,
                is_downloaded: false,
                is_downloading: false,
                download_progress: 0.0,
                is_active: false,
                recommended_for: vec!["matematicas".to_string(), "fracciones".to_string(), "ecuaciones".to_string()],
                tags: vec!["versatil".to_string(), "7B".to_string(), "Q4".to_string()],
            },
            ModelInfo {
                id: "bartowski/Qwen2.5-1.5B-Instruct-GGUF".to_string(),
                name: "Qwen 2.5 1.5B Instruct".to_string(),
                description: "El modelo mas ligero, corre en cualquier PC. Bueno para aritmetica basica".to_string(),
                filename: "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf".to_string(),
                mmproj_filename: None,
                size_mb: 1024.0,
                is_downloaded: false,
                is_downloading: false,
                download_progress: 0.0,
                is_active: false,
                recommended_for: vec!["principiante".to_string(), "aritmetica".to_string(), "pc-antiguo".to_string()],
                tags: vec!["ultra-ligero".to_string(), "1.5B".to_string(), "rapido".to_string()],
            },
        ]
    }

    /// Verifica que modelos ya estan descargados
    pub fn refresh_download_status(&mut self) {
        let model_data: Vec<(String, bool)> = self.available_models.iter()
            .map(|m| (m.id.clone(), self.is_complete(m)))
            .collect();
        
        for (model_id, is_downloaded) in model_data {
            if let Some(model) = self.available_models.iter_mut().find(|m| m.id == model_id) {
                model.is_downloaded = is_downloaded;
                
                if model.is_downloaded && self.active_model_id.as_deref() == Some(&model.id) {
                    model.is_active = true;
                } else {
                    model.is_active = false;
                }
            }
        }
    }

    /// Archivos que forman el modelo: el GGUF y, si tiene vision, su mmproj
    fn model_files(model: &ModelInfo) -> Vec<&str> {
        std::iter::once(model.filename.as_str())
            .chain(model.mmproj_filename.as_deref())
            .collect()
    }

    /// El modelo esta descargado si estan todos sus archivos
    fn is_complete(&self, model: &ModelInfo) -> bool {
        Self::model_files(model).iter().all(|f| self.find_file(model, f).is_some())
    }

    /// Busca el GGUF principal de un modelo ya descargado
    fn find_model_file(&self, model: &ModelInfo) -> Option<PathBuf> {
        self.find_file(model, &model.filename)
    }

    /// Busca un archivo del modelo: primero en el directorio de la app y luego en la
    /// cache estandar de Hugging Face (`models--<id>/snapshots/*/<archivo>`).
    fn find_file(&self, model: &ModelInfo, filename: &str) -> Option<PathBuf> {
        let own = self.get_model_path(filename);
        if own.is_file() {
            return Some(own);
        }
        let hub = match std::env::var("HF_HOME") {
            Ok(hf_home) => PathBuf::from(hf_home).join("hub"),
            Err(_) => PathBuf::from(std::env::var("HOME").ok()?).join(".cache/huggingface/hub"),
        };
        let snapshots = hub
            .join(format!("models--{}", model.id.replace('/', "--")))
            .join("snapshots");
        std::fs::read_dir(snapshots).ok()?
            .flatten()
            .map(|e| e.path().join(filename))
            .find(|p| p.is_file())
    }

    /// Obtiene la ruta donde la app guarda un archivo del modelo
    fn get_model_path(&self, filename: &str) -> PathBuf {
        self.models_dir.join(filename)
    }

    /// Archivo temporal de una descarga en curso o interrumpida (se reanuda con Range)
    fn get_partial_path(&self, filename: &str) -> PathBuf {
        self.models_dir.join(format!("{}.partial", filename))
    }

    /// Lista todos los modelos disponibles
    pub fn list_models(&mut self) -> Vec<ModelInfo> {
        self.refresh_download_status();
        let handles = self.download_handles.lock().unwrap();
        let mut models = self.available_models.clone();
        for m in &mut models {
            if let Some(h) = handles.get(&m.id) {
                let p = h.progress.load(Ordering::SeqCst);
                m.is_downloading = (0..100).contains(&p) && !m.is_downloaded;
                m.download_progress = p.clamp(0, 100) as f64;
            }
        }
        models
    }

    /// Descarga un modelo desde HuggingFace en segundo plano (GGUF y, si tiene, su mmproj).
    /// Como Handy: escribe a `<archivo>.partial`, reanuda con `Range` si ya existe,
    /// y emite `model-download-progress`, `model-download-complete` y `models-updated`.
    pub fn download_model_async(&self, model_id: &str, app: AppHandle) -> Result<()> {
        let model = self.available_models.iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| anyhow::anyhow!("Modelo no encontrado: {}", model_id))?;

        if self.is_complete(model) {
            return Err(anyhow::anyhow!("El modelo ya esta descargado: {}", model_id));
        }
        if let Some(h) = self.download_handles.lock().unwrap().get(model_id) {
            if (0..100).contains(&h.progress.load(Ordering::SeqCst)) {
                return Err(anyhow::anyhow!("El modelo ya se esta descargando: {}", model_id));
            }
        }
        std::fs::create_dir_all(&self.models_dir)?;

        {
            let mut downloading = self.downloading.lock().unwrap();
            downloading.insert(model_id.to_string());
        }

        let progress = Arc::new(AtomicI32::new(0));
        let cancelled = Arc::new(AtomicBool::new(false));
        let paused = Arc::new(AtomicBool::new(false));
        self.download_handles.lock().unwrap().insert(model_id.to_string(), DownloadHandle {
            progress: progress.clone(),
            cancelled: cancelled.clone(),
            paused: paused.clone(),
        });

        // Solo los archivos que faltan: (url, destino final, .partial)
        let files: Vec<(String, PathBuf, PathBuf)> = Self::model_files(model).into_iter()
            .filter(|f| self.find_file(model, f).is_none())
            .map(|f| (
                format!("https://huggingface.co/{}/resolve/main/{}", model_id, f),
                self.get_model_path(f),
                self.get_partial_path(f),
            ))
            .collect();
        let model_id = model_id.to_string();

        tokio::spawn(async move {
            use futures_util::StreamExt;
            use std::io::Write;

            let report = |downloaded: u64, total: u64, value: i32| {
                progress.store(value, Ordering::SeqCst);
                let _ = app.emit("model-download-progress", serde_json::json!({
                    "model_id": model_id,
                    "downloaded": downloaded,
                    "total": total,
                    "percentage": value.max(0),
                }));
            };
            let finish = |value: i32| {
                progress.store(value, Ordering::SeqCst);
                let _ = app.emit("model-download-complete", &model_id);
                let _ = app.emit("models-updated", ());
            };
            let fail = |msg: String| {
                eprintln!("{}", msg);
                finish(-1);
            };
            // 100 se reserva para cuando todos los archivos estan completos
            let percent = |done: u64, total: u64| {
                if total > 0 { ((done * 100 / total) as i32).min(99) } else { 0 }
            };

            let client = reqwest::Client::new();
            // Tamano total de todos los archivos para un progreso unico
            let mut sizes = Vec::new();
            for (url, _, _) in &files {
                let size = match client.head(url).send().await {
                    Ok(r) if r.status().is_success() => r.content_length().unwrap_or(0),
                    _ => 0,
                };
                sizes.push(size);
            }
            let total: u64 = sizes.iter().sum();
            let mut done_before = 0u64;

            for ((url, save_path, part_path), size) in files.iter().zip(&sizes) {
                let mut resume_from = std::fs::metadata(part_path).map(|m| m.len()).unwrap_or(0);

                let mut request = client.get(url);
                if resume_from > 0 {
                    request = request.header(reqwest::header::RANGE, format!("bytes={}-", resume_from));
                }
                let response = match request.send().await {
                    Ok(r) => r,
                    Err(e) => return fail(format!("Error conectando: {}", e)),
                };
                let status = response.status();
                // 416: el .partial ya esta completo
                if status.as_u16() == 416 {
                    if let Err(e) = std::fs::rename(part_path, save_path) {
                        return fail(format!("Error guardando archivo: {}", e));
                    }
                    done_before += size;
                    continue;
                }
                if !status.is_success() {
                    return fail(format!("Error HTTP {} descargando {}", status, url));
                }
                // Servidor ignoro Range (200 en vez de 206): empezar de cero
                if resume_from > 0 && status.as_u16() != 206 {
                    resume_from = 0;
                }

                let mut file = match std::fs::OpenOptions::new()
                    .create(true)
                    .write(true)
                    .append(resume_from > 0)
                    .truncate(resume_from == 0)
                    .open(part_path)
                {
                    Ok(f) => f,
                    Err(e) => return fail(format!("Error creando archivo: {}", e)),
                };

                let mut downloaded = resume_from;
                let mut stream = response.bytes_stream();
                report(done_before + downloaded, total, percent(done_before + downloaded, total));

                while let Some(chunk) = stream.next().await {
                    while paused.load(Ordering::SeqCst) && !cancelled.load(Ordering::SeqCst) {
                        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                    }
                    if cancelled.load(Ordering::SeqCst) {
                        // Como Handy: se conserva el .partial para poder reanudar despues
                        let _ = app.emit("models-updated", ());
                        return;
                    }
                    match chunk {
                        Ok(bytes) => {
                            if let Err(e) = file.write_all(&bytes) {
                                return fail(format!("Error escribiendo archivo: {}", e));
                            }
                            downloaded += bytes.len() as u64;
                            report(done_before + downloaded, total, percent(done_before + downloaded, total));
                        }
                        Err(e) => return fail(format!("Error descargando chunk: {}", e)),
                    }
                }

                drop(file);
                if let Err(e) = std::fs::rename(part_path, save_path) {
                    return fail(format!("Error guardando archivo: {}", e));
                }
                done_before += downloaded.max(*size);
            }

            report(total, total, 100);
            finish(100);
        });

        Ok(())
    }

    /// Pausa una descarga
    pub fn pause_download(&self, model_id: &str) {
        if let Ok(handles) = self.download_handles.lock() {
            if let Some(handle) = handles.get(model_id) {
                handle.paused.store(true, Ordering::SeqCst);
            }
        }
    }

    /// Reanuda una descarga
    pub fn resume_download(&self, model_id: &str) {
        if let Ok(handles) = self.download_handles.lock() {
            if let Some(handle) = handles.get(model_id) {
                handle.paused.store(false, Ordering::SeqCst);
            }
        }
    }

    /// Cancela una descarga
    pub fn cancel_download(&self, model_id: &str) -> bool {
        let mut removed = false;
        if let Ok(mut handles) = self.download_handles.lock() {
            if let Some(handle) = handles.remove(model_id) {
                handle.cancelled.store(true, Ordering::SeqCst);
                removed = true;
            }
        }
        if let Ok(mut downloading) = self.downloading.lock() {
            downloading.remove(model_id);
        }
        removed
    }

    /// Obtiene el progreso de descarga de un modelo
    pub fn get_download_progress(&self, model_id: &str) -> Option<f64> {
        if let Ok(handles) = self.download_handles.lock() {
            if let Some(handle) = handles.get(model_id) {
                return Some(handle.progress.load(Ordering::SeqCst) as f64);
            }
        }
        None
    }

    /// Restaura el modelo activo guardado (sin exigir que ya este descargado)
    pub fn restore_active_model(&mut self, model_id: Option<String>) {
        self.active_model_id = model_id.filter(|id| self.available_models.iter().any(|m| &m.id == id));
        self.refresh_download_status();
    }

    /// Selecciona un modelo como activo
    pub fn select_model(&mut self, model_id: &str) -> Result<()> {
        let model = self.available_models.iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| anyhow::anyhow!("Modelo no encontrado: {}", model_id))?;

        if !model.is_downloaded {
            return Err(anyhow::anyhow!("El modelo no esta descargado: {}", model_id));
        }

        self.active_model_id = Some(model_id.to_string());
        
        for m in &mut self.available_models {
            m.is_active = m.id == model_id;
        }

        Ok(())
    }

    /// Elimina un modelo descargado (todos sus archivos y descargas parciales)
    pub fn delete_model(&mut self, model_id: &str) -> Result<()> {
        let model = self.available_models.iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| anyhow::anyhow!("Modelo no encontrado: {}", model_id))?;

        let mut paths = Vec::new();
        for f in Self::model_files(model) {
            paths.push(self.get_model_path(f));
            paths.push(self.get_partial_path(f));
            paths.extend(self.find_file(model, f));
        }
        for path in paths {
            if path.is_dir() {
                std::fs::remove_dir_all(&path)?;
            } else if path.exists() {
                std::fs::remove_file(&path)?;
            }
        }
        if let Ok(mut handles) = self.download_handles.lock() {
            handles.remove(model_id);
        }
        
        for m in &mut self.available_models {
            if m.id == model_id {
                m.is_downloaded = false;
                m.is_active = false;
            }
        }
        
        if self.active_model_id.as_deref() == Some(model_id) {
            self.active_model_id = None;
        }

        Ok(())
    }

    /// Obtiene el modelo activo actual
    #[allow(dead_code)]
    pub fn get_active_model(&self) -> Option<&ModelInfo> {
        self.available_models.iter().find(|m| m.is_active)
    }

    /// Obtiene la ruta del modelo activo
    #[allow(dead_code)]
    pub fn get_active_model_path(&self) -> Option<PathBuf> {
        self.get_active_model().and_then(|m| self.find_model_file(m))
    }

    /// Archivos del modelo activo para la inferencia integrada (GGUF + mmproj si tiene)
    pub fn get_active_local_model(&self) -> Option<crate::ai::local::LocalModel> {
        let m = self.get_active_model()?;
        let mmproj = match &m.mmproj_filename {
            Some(f) => Some(self.find_file(m, f)?),
            None => None,
        };
        Some(crate::ai::local::LocalModel { model: self.find_model_file(m)?, mmproj })
    }
}
