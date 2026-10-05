use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum AIProvider {
    Local,
    OpenAI,
    Anthropic,
}

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
    pub size_mb: f64,
    pub is_downloaded: bool,
    pub is_downloading: bool,
    pub download_progress: f64,  // 0.0 - 1.0
    pub is_active: bool,
    pub recommended_for: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppSettings {
    pub provider: AIProvider,
    pub openai_key: String,
    pub anthropic_key: String,
    pub active_model_id: Option<String>,
}
