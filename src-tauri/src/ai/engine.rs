use anyhow::Result;
use serde::{Deserialize, Serialize};

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

    pub async fn solve(&self, problem: &MathProblem) -> Result<Solution> {
        match &self.provider {
            AIProvider::OpenAI => Self::solve_with_openai(problem, &self.openai_key).await,
            AIProvider::Anthropic => Self::solve_with_anthropic(problem, &self.anthropic_key).await,
            AIProvider::Local => Self::solve_locally(problem).await,
        }
    }

    // Static method for use in commands
    pub async fn solve_with_settings(problem: &MathProblem, settings: &AppSettings) -> Result<Solution> {
        let engine = Self {
            provider: settings.provider.clone(),
            openai_key: settings.openai_key.clone(),
            anthropic_key: settings.anthropic_key.clone(),
            active_model_id: settings.active_model_id.clone(),
        };
        engine.solve(problem).await
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

        Ok(Self::parse_response(&content, &Self::display_text(problem)))
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

        Ok(Self::parse_response(&content, &Self::display_text(problem)))
    }

    async fn solve_locally(problem: &MathProblem) -> Result<Solution> {
        if problem.image.is_some() {
            return Err(anyhow::anyhow!(
                "El modelo local no puede leer dibujos. Escribe el problema en la pestaña Texto \
                 o usa OpenAI/Anthropic en Configuracion para resolver dibujos."
            ));
        }
        let system_prompt = Self::build_system_prompt();
        let user_prompt = format!("Por favor, explica paso a paso como resolver este problema:\n\n{}", problem.text);
        let full_prompt = format!("{}\n\n{}", system_prompt, user_prompt);
        
        let client = reqwest::Client::new();
        
        match client
            .post("http://localhost:8080/completion")
            .json(&serde_json::json!({
                "prompt": full_prompt,
                "n_predict": 2048,
                "temperature": 0.3,
                "stop": ["\n\n", "User:"]
            }))
            .send()
            .await
        {
            Ok(resp) => {
                let json: serde_json::Value = resp.json().await?;
                let content = json["content"].as_str().unwrap_or("").to_string();
                
                if content.is_empty() {
                    Err(anyhow::anyhow!("El modelo local no genero respuesta."))
                } else {
                    Ok(Self::parse_response(&content, &problem.text))
                }
            }
            Err(_) => {
                Err(anyhow::anyhow!(
                    "No se pudo conectar al modelo local en localhost:8080.\n\n\
                     Para usar IA local:\n\
                     1. Instala llama.cpp: https://github.com/ggerganov/llama.cpp\n\
                     2. Ejecuta: llama-server -m modelo.gguf -c 2048\n\n\
                     O usa OpenAI/Anthropic en Configuracion."
                ))
            }
        }
    }

    pub(crate) fn parse_response(content: &str, problem_text: &str) -> Solution {
        let lines: Vec<&str> = content.lines().collect();
        let mut steps: Vec<SolutionStep> = Vec::new();
        let mut step_num = 1;
        let mut current_step = String::new();
        let mut in_step = false;

        for line in lines {
            let trimmed = line.trim();
            
            if (trimmed.len() > 2 && trimmed.chars().next().unwrap().is_numeric() 
                && trimmed.chars().nth(1) == Some('.'))
                || (trimmed.len() > 2 && trimmed.starts_with("Paso ") && trimmed.contains(':'))
            {
                if in_step && !current_step.is_empty() {
                    steps.push(SolutionStep {
                        step: step_num,
                        explanation: current_step.trim().to_string(),
                    });
                    step_num += 1;
                }
                current_step = trimmed.to_string();
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
