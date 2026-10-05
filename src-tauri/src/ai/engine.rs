use anyhow::Result;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

use crate::ai::local::LocalModel;
use crate::types::{AIProvider, AppSettings, MathProblem, Solution, SolutionStep};

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    #[serde(default)]
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    content: String,
}

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessageInput>,
}

#[derive(Debug, Serialize)]
struct OpenAIMessageInput {
    role: String,
    content: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    #[serde(default)]
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessageInput>,
    max_tokens: u32,
}

#[derive(Debug, Serialize)]
struct AnthropicMessageInput {
    role: String,
    content: serde_json::Value,
}

/// llama-server propio (respaldo) para el modelo activo: (archivos del modelo, puerto, proceso)
static LOCAL_SERVER: Mutex<Option<(LocalModel, u16, tokio::process::Child)>> = Mutex::new(None);

pub struct AIEngine {
    provider: AIProvider,
    openai_key: String,
    anthropic_key: String,
    active_model_id: Option<String>,
}

impl AIEngine {
    pub fn new() -> Self {
        Self {
            provider: AIProvider::Local,
            openai_key: String::new(),
            anthropic_key: String::new(),
            active_model_id: None,
        }
    }

    pub fn configure(&mut self, settings: &AppSettings) {
        self.provider = settings.provider.clone();
        self.openai_key = settings.openai_key.clone();
        self.anthropic_key = settings.anthropic_key.clone();
        self.active_model_id = settings.active_model_id.clone();
    }

    pub async fn solve(&self, problem: &MathProblem, local_model: Option<LocalModel>) -> Result<Solution> {
        match &self.provider {
            AIProvider::OpenAI => Self::solve_with_openai(problem, &self.openai_key).await,
            AIProvider::Anthropic => Self::solve_with_anthropic(problem, &self.anthropic_key).await,
            AIProvider::Local => Self::solve_locally(problem, local_model.as_ref(), self.active_model_id.as_deref()).await,
        }
    }

    // Static method for use in commands
    pub async fn solve_with_settings(problem: &MathProblem, settings: &AppSettings, local_model: Option<LocalModel>) -> Result<Solution> {
        let engine = Self {
            provider: settings.provider.clone(),
            openai_key: settings.openai_key.clone(),
            anthropic_key: settings.anthropic_key.clone(),
            active_model_id: settings.active_model_id.clone(),
        };
        engine.solve(problem, local_model).await
    }

    fn build_system_prompt() -> String {
        r#"Eres un profesor de matematicas paciente y claro. Tu trabajo es explicar paso a paso como resolver problemas de matematicas basicos.

TIPOS DE PROBLEMAS:
- Aritmetica: suma, resta, multiplicacion, division
- Ecuaciones simples: x + 5 = 12, 3x = 15, 2x + 3 = 7
- Fracciones: sumar, restar, multiplicar, dividir fracciones

REGLAS IMPORTANTES:
1. SIEMPRE responde en español
2. Explica cada paso de forma clara y detallada, como si le enseñaras a un estudiante
3. Usa un tono amigable y paciente
4. Al final, da la respuesta final claramente con "Respuesta final:"
5. Para fracciones, simplifica siempre cuando sea posible
6. Usa formato claro con saltos de linea entre cada paso
7. NO des solo la respuesta - explica el PROCESO completo"#.to_string()
    }

    /// Texto del usuario; si hay dibujo, se le pide al modelo que lea la imagen
    fn user_prompt(problem: &MathProblem) -> String {
        if problem.image.is_some() {
            "La imagen contiene un problema de matematicas escrito a mano. Primero transcribelo \
             en una linea que empiece con \"Problema:\" y luego explica paso a paso como resolverlo."
                .to_string()
        } else {
            format!("Por favor, explica paso a paso como resolver este problema:\n\n{}", problem.text)
        }
    }

    /// Contenido del mensaje de usuario en formato OpenAI (texto, o texto + imagen)
    fn user_content(problem: &MathProblem) -> serde_json::Value {
        match &problem.image {
            Some(image) => serde_json::json!([
                { "type": "text", "text": Self::user_prompt(problem) },
                { "type": "image_url", "image_url": { "url": image } },
            ]),
            None => serde_json::json!(Self::user_prompt(problem)),
        }
    }

    /// Si el modelo transcribio el dibujo ("Problema: ..."), usarlo como enunciado
    pub(crate) fn with_transcription(mut solution: Solution, content: &str, problem: &MathProblem) -> Solution {
        if problem.image.is_some() {
            let transcribed = content.lines().find_map(|l| {
                let clean = l.trim().trim_start_matches(|c: char| c == '*' || c == '#' || c == ' ');
                clean.strip_prefix("Problema:").map(|t| t.trim().trim_matches('*').trim().to_string())
            });
            if let Some(t) = transcribed.filter(|t| !t.is_empty()) {
                solution.problem = t;
            }
        }
        solution
    }

    /// Texto que se muestra como enunciado en la solucion
    fn display_text(problem: &MathProblem) -> String {
        if problem.text.trim().is_empty() && problem.image.is_some() {
            "Problema dibujado".to_string()
        } else {
            problem.text.clone()
        }
    }

    /// Devuelve (media_type, base64) de un data URL
    fn split_data_url(url: &str) -> Result<(String, String)> {
        let rest = url.strip_prefix("data:")
            .ok_or_else(|| anyhow::anyhow!("Imagen invalida"))?;
        let (meta, data) = rest.split_once(',')
            .ok_or_else(|| anyhow::anyhow!("Imagen invalida"))?;
        Ok((meta.trim_end_matches(";base64").to_string(), data.to_string()))
    }

    /// Convierte una respuesta HTTP en JSON, mostrando el mensaje de error del proveedor
    async fn read_json(resp: reqwest::Response, provider: &str) -> Result<serde_json::Value> {
        let status = resp.status();
        let body: serde_json::Value = resp.json().await
            .map_err(|e| anyhow::anyhow!("Respuesta invalida de {}: {}", provider, e))?;
        if !status.is_success() {
            let msg = body["error"]["message"].as_str().unwrap_or("error desconocido");
            return Err(anyhow::anyhow!("{} respondio {}: {}", provider, status, msg));
        }
        Ok(body)
    }

    async fn solve_with_openai(problem: &MathProblem, api_key: &str) -> Result<Solution> {
        if api_key.trim().is_empty() {
            return Err(anyhow::anyhow!("Falta la API key de OpenAI. Agregala en Configuracion."));
        }
        let user_prompt = Self::user_prompt(problem);
        let user_content = match &problem.image {
            Some(image) => serde_json::json!([
                { "type": "text", "text": user_prompt },
                { "type": "image_url", "image_url": { "url": image } },
            ]),
            None => serde_json::json!(user_prompt),
        };

        let resp = reqwest::Client::new()
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&OpenAIRequest {
                model: if problem.image.is_some() { "gpt-4o-mini" } else { "gpt-3.5-turbo" }.to_string(),
                messages: vec![
                    OpenAIMessageInput { role: "system".to_string(), content: serde_json::json!(Self::build_system_prompt()) },
                    OpenAIMessageInput { role: "user".to_string(), content: user_content },
                ],
            })
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("No se pudo conectar con OpenAI: {}", e))?;

        let body = Self::read_json(resp, "OpenAI").await?;
        let parsed: OpenAIResponse = serde_json::from_value(body)?;
        let content = parsed.choices.first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| anyhow::anyhow!("OpenAI no devolvio respuesta"))?;

        Ok(Self::with_transcription(Self::parse_response(&content, &Self::display_text(problem)), &content, problem))
    }

    async fn solve_with_anthropic(problem: &MathProblem, api_key: &str) -> Result<Solution> {
        if api_key.trim().is_empty() {
            return Err(anyhow::anyhow!("Falta la API key de Anthropic. Agregala en Configuracion."));
        }
        let user_prompt = format!("{}\n\n{}", Self::build_system_prompt(), Self::user_prompt(problem));
        let user_content = match &problem.image {
            Some(image) => {
                let (media_type, data) = Self::split_data_url(image)?;
                serde_json::json!([
                    { "type": "image", "source": { "type": "base64", "media_type": media_type, "data": data } },
                    { "type": "text", "text": user_prompt },
                ])
            }
            None => serde_json::json!(user_prompt),
        };

        let resp = reqwest::Client::new()
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&AnthropicRequest {
                model: "claude-3-haiku-20240307".to_string(),
                messages: vec![AnthropicMessageInput { role: "user".to_string(), content: user_content }],
                max_tokens: 2048,
            })
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("No se pudo conectar con Anthropic: {}", e))?;

        let body = Self::read_json(resp, "Anthropic").await?;
        let parsed: AnthropicResponse = serde_json::from_value(body)?;
        let content = parsed.content.first()
            .map(|c| c.text.clone())
            .ok_or_else(|| anyhow::anyhow!("Anthropic no devolvio respuesta"))?;

        Ok(Self::with_transcription(Self::parse_response(&content, &Self::display_text(problem)), &content, problem))
    }

    async fn solve_locally(problem: &MathProblem, local_model: Option<&LocalModel>, active_id: Option<&str>) -> Result<Solution> {
        // Solo modelos propios de la app (como Handy): no se conecta a servidores externos.
        let Some(files) = local_model else {
            return Err(anyhow::anyhow!(match active_id {
                Some(_) => "El modelo activo no esta descargado. Descargalo en Configuracion.",
                None => "No hay un modelo local activo. Descarga y selecciona uno en Configuracion.",
            }));
        };

        // 1) Inferencia dentro de la app (sin puertos).
        // 2) Si falla y hay llama-server instalado, se lanza uno propio en un puerto libre.
        let embedded_error = match Self::solve_embedded(problem, files).await {
            Ok(solution) => return Ok(solution),
            Err(e) => e,
        };
        let Some(base) = Self::ensure_own_server(files).await? else {
            return Err(embedded_error);
        };

        // llama-server aplica la plantilla de chat del modelo en /v1/chat/completions
        let resp = reqwest::Client::new()
            .post(format!("{}/v1/chat/completions", base))
            .json(&serde_json::json!({
                "messages": [
                    { "role": "system", "content": Self::build_system_prompt() },
                    { "role": "user", "content": Self::user_content(problem) },
                ],
                "max_tokens": 4096,
                "temperature": 0.3,
            }))
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("No se pudo conectar con llama-server: {}", e))?;

        let body = Self::read_json(resp, "El modelo local").await?;
        let content = body["choices"][0]["message"]["content"].as_str().unwrap_or("").trim();
        if content.is_empty() {
            return Err(anyhow::anyhow!("El modelo local no genero respuesta."));
        }
        Ok(Self::with_transcription(Self::parse_response(content, &Self::display_text(problem)), content, problem))
    }

    /// Resuelve con llama.cpp integrado en la app (en un hilo aparte: es bloqueante)
    async fn solve_embedded(problem: &MathProblem, files: &LocalModel) -> Result<Solution> {
        // El dibujo llega como data URL; el modelo recibe los bytes de la imagen
        let image = match &problem.image {
            Some(url) => {
                use base64::Engine;
                let (_, data) = Self::split_data_url(url)?;
                Some(base64::engine::general_purpose::STANDARD.decode(data)
                    .map_err(|_| anyhow::anyhow!("Imagen invalida"))?)
            }
            None => None,
        };
        let files = files.clone();
        let user = Self::user_prompt(problem);
        let content = tokio::task::spawn_blocking(move || {
            crate::ai::local::generate(&files, &Self::build_system_prompt(), &user, image.as_deref())
        })
        .await??;
        if content.is_empty() {
            return Err(anyhow::anyhow!("El modelo local no genero respuesta."));
        }
        Ok(Self::with_transcription(Self::parse_response(&content, &Self::display_text(problem)), &content, problem))
    }

    /// Localiza el binario de llama-server (LLAMA_SERVER_BIN o PATH)
    fn find_llama_server() -> Option<PathBuf> {
        if let Ok(bin) = std::env::var("LLAMA_SERVER_BIN") {
            let p = PathBuf::from(bin);
            if p.is_file() {
                return Some(p);
            }
        }
        std::env::var_os("PATH").and_then(|paths| {
            std::env::split_paths(&paths)
                .map(|d| d.join("llama-server"))
                .find(|p| p.is_file())
        })
    }

    /// Arranca (o reutiliza) un llama-server con el GGUF dado en un puerto propio.
    /// Devuelve la URL base, o None si llama-server no esta instalado.
    async fn ensure_own_server(files: &LocalModel) -> Result<Option<String>> {
        let Some(bin) = Self::find_llama_server() else { return Ok(None) };
        let port = Self::start_or_reuse_server(&bin, files)?;
        let base = format!("http://127.0.0.1:{}", port);
        Self::wait_for_server(&base).await?;
        Ok(Some(base))
    }

    /// Puerto libre asignado por el sistema, para no chocar con otro llama-server de la PC
    fn free_port() -> Result<u16> {
        let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
        Ok(listener.local_addr()?.port())
    }

    /// Parte sincrona (el guard del Mutex no puede cruzar un await). Devuelve el puerto.
    fn start_or_reuse_server(bin: &Path, files: &LocalModel) -> Result<u16> {
        let mut guard = LOCAL_SERVER.lock().unwrap();
        if let Some((loaded, port, child)) = guard.as_mut() {
            let alive = matches!(child.try_wait(), Ok(None));
            if alive && loaded == files {
                return Ok(*port);
            }
            let _ = child.start_kill(); // otro modelo activo o proceso caido
        }
        let port = Self::free_port()?;
        let mut cmd = tokio::process::Command::new(bin);
        cmd.arg("-m").arg(&files.model);
        if let Some(mmproj) = &files.mmproj {
            cmd.arg("--mmproj").arg(mmproj);
        }
        let child = cmd
            .args(["--host", "127.0.0.1", "--port", &port.to_string(), "-c", "4096"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| anyhow::anyhow!("No se pudo iniciar llama-server: {}", e))?;
        *guard = Some((files.clone(), port, child));
        Ok(port)
    }

    /// Espera a que llama-server termine de cargar el modelo (hasta 3 minutos)
    async fn wait_for_server(base: &str) -> Result<()> {
        let client = reqwest::Client::new();
        for _ in 0..180 {
            if let Ok(r) = client.get(format!("{}/health", base)).send().await {
                if r.status().is_success() {
                    return Ok(());
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
        Err(anyhow::anyhow!("llama-server no termino de cargar el modelo a tiempo"))
    }

    pub(crate) fn parse_response(content: &str, problem_text: &str) -> Solution {
        let lines: Vec<&str> = content.lines().collect();
        let mut steps: Vec<SolutionStep> = Vec::new();
        let mut step_num = 1;
        let mut current_step = String::new();
        let mut in_step = false;

        for line in lines {
            let trimmed = line.trim();
            // Tolerar markdown: "**Paso 1:** ...", "### 1. ..."
            let clean = trimmed.trim_start_matches(|c: char| c == '*' || c == '#' || c == ' ');
            let lower = clean.to_lowercase();

            if lower.starts_with("respuesta final") || lower.starts_with("resultado final") {
                // La respuesta final no es un paso: cerrar el paso actual
                if in_step && !current_step.is_empty() {
                    steps.push(SolutionStep {
                        step: step_num,
                        explanation: current_step.trim().to_string(),
                    });
                    step_num += 1;
                    current_step = String::new();
                    in_step = false;
                }
            } else if (clean.len() > 2 && clean.chars().next().unwrap().is_numeric()
                && clean.chars().nth(1) == Some('.'))
                || (clean.len() > 2 && clean.starts_with("Paso ") && clean.contains(':'))
            {
                if in_step && !current_step.is_empty() {
                    steps.push(SolutionStep {
                        step: step_num,
                        explanation: current_step.trim().to_string(),
                    });
                    step_num += 1;
                }
                current_step = clean.replace("**", "");
                in_step = true;
            } else if trimmed.is_empty() {
                if in_step && !current_step.is_empty() {
                    steps.push(SolutionStep {
                        step: step_num,
                        explanation: current_step.trim().to_string(),
                    });
                    step_num += 1;
                    current_step = String::new();
                    in_step = false;
                }
            } else if in_step {
                current_step.push('\n');
                current_step.push_str(trimmed);
            }
        }

        if in_step && !current_step.is_empty() {
            steps.push(SolutionStep {
                step: step_num,
                explanation: current_step.trim().to_string(),
            });
        }

        if steps.is_empty() {
            steps.push(SolutionStep {
                step: 1,
                explanation: content.to_string(),
            });
        }

        let final_answer = content.lines()
            .rev()
            .find(|l| {
                let lower = l.to_lowercase();
                lower.contains("respuesta final")
                    || lower.contains("resultado final")
            })
            .map(|l| l.trim().to_string())
            .unwrap_or_else(|| "Revisa la explicacion paso a paso".to_string());

        Solution {
            problem: problem_text.to_string(),
            steps,
            final_answer,
        }
    }
}
