use anyhow::Result;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::ai::local::LocalModel;
use crate::types::{AppSettings, MathProblem, Solution, SolutionStep};

/// llama-server propio (respaldo) para el modelo activo: (archivos del modelo, puerto, proceso)
static LOCAL_SERVER: Mutex<Option<(LocalModel, u16, tokio::process::Child)>> = Mutex::new(None);

/// Solo modelos locales: la inferencia corre dentro de la app
pub struct AIEngine {
    active_model_id: Option<String>,
}

impl AIEngine {
    pub fn new() -> Self {
        Self { active_model_id: None }
    }

    pub fn configure(&mut self, settings: &AppSettings) {
        self.active_model_id = settings.active_model_id.clone();
    }

    pub async fn solve(&self, problem: &MathProblem, local_model: Option<LocalModel>) -> Result<Solution> {
        Self::solve_locally(problem, local_model.as_ref(), self.active_model_id.as_deref()).await
    }

    // Static method for use in commands
    pub async fn solve_with_settings(problem: &MathProblem, settings: &AppSettings, local_model: Option<LocalModel>) -> Result<Solution> {
        let engine = Self { active_model_id: settings.active_model_id.clone() };
        engine.solve(problem, local_model).await
    }

    fn build_system_prompt() -> String {
        r#"Eres una maestra de primaria paciente y carinosa. Explicas a ninos de 7 a 12 anos como resolver problemas de matematicas, paso a paso.

Responde SOLO con un objeto JSON con este formato:
{"problema": "...", "pasos": [{"titulo": "...", "explicacion": "...", "operacion": "..."}], "respuesta_final": "..."}

REGLAS:
1. Todo en espanol, con frases cortas y palabras sencillas, como le hablarias a un nino.
2. Cada paso hace UNA sola cosa. Usa entre 2 y 6 pasos.
3. "titulo": maximo 6 palabras (por ejemplo "Quitamos el 3 de los dos lados").
4. "explicacion": 1 o 2 frases que digan que hacemos y por que.
5. "operacion": la cuenta de ese paso en texto plano, por ejemplo "2x = 7 - 3 = 4" o "3 × 3 = 9". Sin LaTeX ni simbolos $. Vacia ("") si el paso no tiene cuenta.
6. "problema": el enunciado tal cual (si viene en una imagen, transcribelo).
7. "respuesta_final": solo el resultado, por ejemplo "x = 5" o "18".
8. Para fracciones, simplifica siempre que se pueda. Revisa tus cuentas antes de responder."#.to_string()
    }

    #[cfg(test)]
    pub(crate) fn system_prompt_for_tests() -> String {
        Self::build_system_prompt()
    }

    /// Esquema JSON de la respuesta; llama.cpp lo convierte en gramatica y el modelo no puede salirse
    pub(crate) fn solution_schema() -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "problema": { "type": "string" },
                "pasos": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 8,
                    "items": {
                        "type": "object",
                        "properties": {
                            "titulo": { "type": "string" },
                            "explicacion": { "type": "string" },
                            "operacion": { "type": "string" }
                        },
                        "required": ["titulo", "explicacion", "operacion"]
                    }
                },
                "respuesta_final": { "type": "string" }
            },
            "required": ["problema", "pasos", "respuesta_final"]
        })
    }

    /// Gramatica GBNF del esquema (se calcula una vez)
    fn solution_grammar() -> Option<&'static str> {
        static GRAMMAR: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
        GRAMMAR.get_or_init(|| {
            llama_cpp_2::json_schema_to_grammar(&Self::solution_schema().to_string())
                .map_err(|e| eprintln!("No se pudo crear la gramatica JSON: {}", e))
                .ok()
        }).as_deref()
    }

    /// Convierte la respuesta JSON del modelo en una solucion
    pub(crate) fn parse_structured(content: &str, problem: &MathProblem) -> Option<Solution> {
        #[derive(serde::Deserialize)]
        struct Paso { titulo: String, explicacion: String, #[serde(default)] operacion: String }
        #[derive(serde::Deserialize)]
        struct Respuesta { problema: String, pasos: Vec<Paso>, respuesta_final: String }

        // Tolerar texto alrededor del objeto (p. ej. un bloque ```json)
        let json = &content[content.find('{')?..=content.rfind('}')?];
        let r: Respuesta = serde_json::from_str(json).ok()?;
        if r.pasos.is_empty() {
            return None;
        }
        let problema = if problem.image.is_some() && !r.problema.trim().is_empty() {
            r.problema.trim().to_string()
        } else {
            Self::display_text(problem)
        };
        let some = |s: String| Some(s.trim().to_string()).filter(|s| !s.is_empty());
        Some(Solution {
            problem: problema,
            steps: r.pasos.into_iter().enumerate().map(|(i, p)| SolutionStep {
                step: i + 1,
                explanation: p.explicacion.trim().to_string(),
                title: some(p.titulo),
                calculation: some(p.operacion),
            }).collect(),
            final_answer: r.respuesta_final.trim().to_string(),
        })
    }

    /// Respuesta del modelo -> solucion: JSON estructurado o, si no, texto libre
    fn to_solution(content: &str, problem: &MathProblem) -> Solution {
        Self::parse_structured(content, problem).unwrap_or_else(|| {
            Self::with_transcription(Self::parse_response(content, &Self::display_text(problem)), content, problem)
        })
    }

    /// Texto del usuario; si hay dibujo, se le pide al modelo que lea la imagen
    fn user_prompt(problem: &MathProblem) -> String {
        if problem.image.is_some() {
            "La imagen tiene un problema de matematicas escrito a mano. Transcribelo en \"problema\" \
             y explica paso a paso como resolverlo."
                .to_string()
        } else {
            format!("Explica paso a paso como resolver este problema:\n\n{}", problem.text)
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
            let clean = |l: &str| l.trim().trim_start_matches(|c: char| c == '*' || c == '#' || c == ' ')
                .trim_matches('*').trim().to_string();
            let lines: Vec<String> = content.lines().map(clean).collect();
            // "Problema: 3x + 4 = 19", o "Problema:" con el enunciado en las lineas siguientes
            let transcribed = lines.iter().position(|l| l.starts_with("Problema:")).and_then(|i| {
                let same_line = lines[i]["Problema:".len()..].trim().trim_matches('*').trim().to_string();
                if !same_line.is_empty() {
                    return Some(same_line);
                }
                let following: Vec<&str> = lines[i + 1..].iter()
                    .skip_while(|l| l.is_empty())
                    .take_while(|l| !l.is_empty() && !l.starts_with("---"))
                    .map(|l| l.as_str())
                    .collect();
                Some(following.join(" "))
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
                "response_format": { "type": "json_object", "schema": Self::solution_schema() },
            }))
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("No se pudo conectar con llama-server: {}", e))?;

        let body = Self::read_json(resp, "El modelo local").await?;
        let content = body["choices"][0]["message"]["content"].as_str().unwrap_or("").trim();
        if content.is_empty() {
            return Err(anyhow::anyhow!("El modelo local no genero respuesta."));
        }
        Ok(Self::to_solution(content, problem))
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
        let generation = tokio::task::spawn_blocking(move || {
            crate::ai::local::generate(&files, &Self::build_system_prompt(), &user, image.as_deref(), Self::solution_grammar())
        })
        .await??;
        crate::ai::local::record_speed(generation.tokens_per_second);
        let content = generation.text;
        if content.is_empty() {
            return Err(anyhow::anyhow!("El modelo local no genero respuesta."));
        }
        Ok(Self::to_solution(&content, problem))
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
                        title: None,
                        calculation: None,
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
                        title: None,
                        calculation: None,
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
                        title: None,
                        calculation: None,
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
                title: None,
                calculation: None,
            });
        }

        if steps.is_empty() {
            steps.push(SolutionStep {
                step: 1,
                explanation: content.to_string(),
                title: None,
                calculation: None,
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
