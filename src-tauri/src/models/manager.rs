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
    /// Velocidad medida en esta PC por modelo (tokens/segundo)
    speeds: std::collections::HashMap<String, f64>,
    /// Memoria disponible para modelos: (VRAM de la GPU, RAM), en MB
    hardware_mb: Option<(Option<f64>, f64)>,
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
            speeds: std::collections::HashMap::new(),
            hardware_mb: None,
        }
    }

    /// Restaura las velocidades medidas guardadas
    pub fn set_speeds(&mut self, speeds: std::collections::HashMap<String, f64>) {
        self.speeds = speeds;
    }

    /// Registra la velocidad medida de un modelo y devuelve todas (para persistirlas)
    pub fn record_speed(&mut self, model_id: &str, tokens_per_second: f64) -> &std::collections::HashMap<String, f64> {
        self.speeds.insert(model_id.to_string(), tokens_per_second);
        &self.speeds
    }

    /// Fija la memoria disponible (VRAM de la GPU si hay, y RAM) para elegir el recomendado
    pub fn set_hardware(&mut self, gpu_vram_mb: Option<f64>, ram_mb: f64) {
        self.hardware_mb = Some((gpu_vram_mb, ram_mb));
    }

    /// El mejor modelo (mayor benchmark) que cabe entero en la GPU; sin GPU, el mejor que
    /// corre con soltura en CPU (hasta ~3.5 GB) y cabe en la RAM
    fn recommended_id(&self) -> Option<String> {
        let (gpu, ram) = self.hardware_mb?;
        let limit = match gpu {
            Some(vram) => vram - 1536.0,
            None => 3500.0_f64.min(ram / 2.0),
        };
        // Solo se comparan puntajes del mismo benchmark (MATH-Vision); los demas van detras
        let key = |m: &ModelInfo| {
            let comparable = m.benchmark.as_deref().is_some_and(|b| b.starts_with("MATH-Vision"));
            (comparable, m.benchmark_score.unwrap_or(0.0))
        };
        self.available_models.iter()
            .filter(|m| m.size_mb <= limit)
            .max_by(|a, b| {
                let (ka, kb) = (key(a), key(b));
                ka.0.cmp(&kb.0).then(ka.1.total_cmp(&kb.1))
            })
            .map(|m| m.id.clone())
    }

    /// Fija el directorio de modelos y lo crea si no existe
    pub fn set_models_dir(&mut self, dir: PathBuf) -> Result<()> {
        std::fs::create_dir_all(&dir)?;
        self.models_dir = dir;
        self.refresh_download_status();
        Ok(())
    }

    /// Lista de modelos disponibles predefinidos: todos leen dibujos (GGUF + mmproj).
    /// Benchmarks tomados de las fichas oficiales en Hugging Face (Qwen y Google).
    pub(crate) fn get_default_models() -> Vec<ModelInfo> {
        vec![
            // Pequenos: corren en cualquier PC
            Self::vision_model(
                "unsloth/Qwen3.5-2B-GGUF", "Qwen 3.5 2B",
                "El mas ligero: corre bien incluso sin GPU",
                "Qwen3.5-2B-Q4_K_M.gguf", "mmproj-Qwen3.5-2B-F16.gguf", Some("mmproj-F16.gguf"),
                1949.0, ("MathVista", 73.9), "pequeño", "2B",
            ),
            Self::vision_model(
                "ggml-org/gemma-4-E2B-it-GGUF", "Gemma 4 E2B (Google)",
                "Modelo ligero de Google pensado para equipos modestos",
                "gemma-4-E2B-it-Q4_0.gguf", "mmproj-gemma-4-E2B-it-Q8_0.gguf", None,
                3398.0, ("MATH-Vision", 52.4), "pequeño", "E2B",
            ),
            // Medianos: buen equilibrio entre calidad y velocidad
            Self::vision_model(
                "unsloth/Qwen3.5-4B-GGUF", "Qwen 3.5 4B",
                "Muy buen razonamiento matematico para su tamano",
                "Qwen3.5-4B-Q4_K_M.gguf", "mmproj-Qwen3.5-4B-F16.gguf", Some("mmproj-F16.gguf"),
                3413.0, ("MATH-Vision", 74.6), "mediano", "4B",
            ),
            Self::vision_model(
                "Qwen/Qwen3-VL-4B-Instruct-GGUF", "Qwen 3 VL 4B",
                "Especializado en leer imagenes y texto escrito a mano",
                "Qwen3VL-4B-Instruct-Q4_K_M.gguf", "mmproj-Qwen3VL-4B-Instruct-Q8_0.gguf", None,
                2950.0, ("MathVista", 79.5), "mediano", "4B",
            ),
            Self::vision_model(
                "ggml-org/gemma-4-E4B-it-GGUF", "Gemma 4 E4B (Google)",
                "Modelo mediano de Google con buena comprension de imagenes",
                "gemma-4-E4B-it-Q4_0.gguf", "mmproj-gemma-4-E4B-it-Q8_0.gguf", None,
                5151.0, ("MATH-Vision", 59.5), "mediano", "E4B",
            ),
            // Grandes: necesitan GPU con 8 GB o mas
            Self::vision_model(
                "unsloth/Qwen3.5-9B-GGUF", "Qwen 3.5 9B",
                "Explicaciones de alta calidad; recomendado con GPU",
                "Qwen3.5-9B-Q4_K_M.gguf", "mmproj-Qwen3.5-9B-F16.gguf", Some("mmproj-F16.gguf"),
                6599.0, ("MATH-Vision", 78.9), "grande", "9B",
            ),
            Self::vision_model(
                "ggml-org/gemma-4-12b-it-GGUF", "Gemma 4 12B (Google)",
                "El mejor de Google que cabe en una GPU de 8-12 GB",
                "gemma-4-12B-it-Q4_0.gguf", "mmproj-gemma-4-12B-it-Q8_0.gguf", None,
                7379.0, ("MATH-Vision", 79.7), "grande", "12B",
            ),
            // Muy grandes (MoE): reparten capas entre GPU y CPU si no caben
            Self::vision_model(
                "ggml-org/gemma-4-26B-A4B-it-GGUF", "Gemma 4 26B A4B (Google)",
                "Mixture of experts: calidad alta con la velocidad de un modelo de 4B",
                "gemma-4-26B-A4B-it-Q4_0.gguf", "mmproj-gemma-4-26B-A4B-it-Q8_0.gguf", None,
                15424.0, ("MATH-Vision", 82.4), "muy grande", "26B-A4B",
            ),
            Self::vision_model(
                "unsloth/Qwen3.5-35B-A3B-GGUF", "Qwen 3.5 35B A3B",
                "El mas potente: mixture of experts, requiere 32 GB de RAM o GPU grande",
                "Qwen3.5-35B-A3B-Q4_K_M.gguf", "mmproj-Qwen3.5-35B-A3B-F16.gguf", Some("mmproj-F16.gguf"),
                22915.0, ("MATH-Vision", 83.9), "muy grande", "35B-A3B",
            ),
        ]
    }

    #[allow(clippy::too_many_arguments)]
    fn vision_model(
        id: &str, name: &str, description: &str,
        filename: &str, mmproj: &str, mmproj_remote: Option<&str>,
        size_mb: f64, (bench_name, bench_score): (&str, f64), tier: &str, params: &str,
    ) -> ModelInfo {
        ModelInfo {
            id: id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
            filename: filename.to_string(),
            mmproj_filename: Some(mmproj.to_string()),
            mmproj_remote: mmproj_remote.map(String::from),
            size_mb,
            benchmark: Some(format!("{} {:.1}%", bench_name, bench_score)),
            benchmark_score: Some(bench_score),
            tokens_per_second: None,
            is_recommended: false,
            is_downloaded: false,
            is_downloading: false,
            download_progress: 0.0,
            is_active: false,
            recommended_for: vec!["dibujos".to_string(), "matematicas".to_string()],
            tags: vec![tier.to_string(), params.to_string()],
        }
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

    /// Nombre del archivo en el repositorio de Hugging Face (puede diferir del nombre en disco)
    fn remote_name<'a>(model: &'a ModelInfo, local: &'a str) -> &'a str {
        match (&model.mmproj_filename, &model.mmproj_remote) {
            (Some(mmproj), Some(remote)) if mmproj == local => remote,
            _ => local,
        }
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
            .map(|e| e.path().join(Self::remote_name(model, filename)))
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
        let recommended = self.recommended_id();
        for m in &mut models {
            m.tokens_per_second = self.speeds.get(&m.id).copied();
            m.is_recommended = recommended.as_deref() == Some(m.id.as_str());
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
                format!("https://huggingface.co/{}/resolve/main/{}", model_id, Self::remote_name(model, f)),
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
