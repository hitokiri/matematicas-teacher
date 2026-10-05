use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MathProblem {
    pub text: String,
    /// Dibujo del problema como data URL (png), si el usuario lo dibujo
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SolutionStep {
    pub step: usize,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Solution {
    pub problem: String,
    pub steps: Vec<SolutionStep>,
    pub final_answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub filename: String,
    /// Proyector de vision (mmproj) para modelos que leen imagenes
    #[serde(default)]
    pub mmproj_filename: Option<String>,
    /// Nombre del mmproj en el repositorio si es generico (p. ej. "mmproj-F16.gguf");
    /// en disco se guarda como `mmproj_filename` para no chocar entre modelos
    #[serde(skip)]
    pub mmproj_remote: Option<String>,
    pub size_mb: f64,
    /// Benchmark de matematicas publicado por el autor (p. ej. "MATH-Vision 74.6%")
    #[serde(default)]
    pub benchmark: Option<String>,
    /// Puntaje de ese benchmark, para elegir el recomendado
    #[serde(skip)]
    pub benchmark_score: Option<f64>,
    /// Velocidad medida en esta PC (tokens/segundo), tras usar el modelo
    #[serde(default)]
    pub tokens_per_second: Option<f64>,
    /// Mejor modelo que cabe en el hardware de esta PC
    #[serde(default)]
    pub is_recommended: bool,
    pub is_downloaded: bool,
    pub is_downloading: bool,
    pub download_progress: f64,  // 0.0 - 1.0
    pub is_active: bool,
    pub recommended_for: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppSettings {
    pub active_model_id: Option<String>,
}
