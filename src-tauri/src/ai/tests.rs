use crate::ai::AIEngine;

#[test]
fn test_parse_response_with_numbered_steps() {
    let content = "1. Primero, identificamos los terminos semejantes
2. Luego, sumamos los coeficientes de x
3. Finalmente, despejamos x

Respuesta final: x = 3";
    
    let problem = "2x + 3 = 9";
    let solution = AIEngine::parse_response(content, problem);
    
    assert!(!solution.steps.is_empty(), "Deberia haber al menos un paso");
    assert_eq!(solution.problem, "2x + 3 = 9");
    assert!(solution.final_answer.contains("x = 3"));
}

#[test]
fn test_parse_response_with_paso_format() {
    let content = "Paso 1: Identificamos la ecuacion
Paso 2: Restamos 3 de ambos lados
Paso 3: Dividimos entre 2

Respuesta final: x = 3";
    
    let problem = "2x + 6 = 12";
    let solution = AIEngine::parse_response(content, problem);
    
    assert!(!solution.steps.is_empty(), "Deberia haber al menos un paso");
}

#[test]
fn test_parse_response_with_empty_content() {
    let content = "";
    let problem = "2 + 2";
    let solution = AIEngine::parse_response(content, problem);
    
    assert!(!solution.steps.is_empty(), "Deberia haber al menos un paso fallback");
    assert_eq!(solution.steps[0].explanation, "");
}

#[test]
fn test_parse_response_with_single_line() {
    let content = "La respuesta es 4";
    let problem = "2 + 2";
    let solution = AIEngine::parse_response(content, problem);
    
    assert!(!solution.steps.is_empty(), "Debe crear un paso para contenido sin formato");
}

#[test]
fn test_parse_response_finds_final_answer() {
    let content = "Paso 1: Sumar los numeros
Paso 2: El resultado es 5

Resultado final: 5";
    
    let problem = "2 + 3";
    let solution = AIEngine::parse_response(content, problem);
    
    assert!(solution.final_answer.contains("5"), 
        "Deberia encontrar el resultado final: {}", solution.final_answer);
}

#[test]
fn test_parse_response_with_multiple_steps() {
    let content = "1. Sumar 2 + 3 = 5
2. Multiplicar 5 * 2 = 10
3. Restar 10 - 3 = 7

Respuesta final: 7";
    
    let problem = "(2 + 3) * 2 - 3";
    let solution = AIEngine::parse_response(content, problem);
    
    assert!(solution.steps.len() >= 2, 
        "Deberia haber al menos 2 pasos, tiene {}", solution.steps.len());
}

#[test]
fn test_parse_response_step_numbers_are_sequential() {
    let content = "1. Primer paso
2. Segundo paso
3. Tercer paso";
    
    let problem = "test";
    let solution = AIEngine::parse_response(content, problem);
    
    if solution.steps.len() >= 3 {
        assert_eq!(solution.steps[0].step, 1);
        assert_eq!(solution.steps[1].step, 2);
        assert_eq!(solution.steps[2].step, 3);
    }
}

#[test]
fn test_parse_response_with_newlines_in_step() {
    let content = "1. Primer paso con multiple lineas
   linea 2 del paso
2. Segundo paso

Respuesta final: 42";
    
    let problem = "test";
    let solution = AIEngine::parse_response(content, problem);
    
    assert!(!solution.steps.is_empty());
    assert!(solution.final_answer.contains("42"));
}

#[test]
fn test_parse_response_with_no_final_answer_marker() {
    let content = "Paso 1: Hacer algo
Paso 2: Hacer otra cosa";
    
    let problem = "test";
    let solution = AIEngine::parse_response(content, problem);
    
    assert!(!solution.final_answer.is_empty());
    assert!(solution.final_answer.contains("explicacion paso a paso") || 
            solution.final_answer.contains("Hacer"));
}

#[test]
fn test_parse_response_preserves_problem_text() {
    let content = "1. Resolver
2. Listo";
    
    let problem = "x + 5 = 12, encontrar x";
    let solution = AIEngine::parse_response(content, problem);
    
    assert_eq!(solution.problem, "x + 5 = 12, encontrar x");
}

#[test]
fn test_parse_response_markdown_steps_and_final_answer() {
    let content = "# Calculo de 34 x 444

**Paso 1:** Descomponer 444 = 400 + 40 + 4

**Paso 2:** Multiplicar 34 por cada parte:
- 34 x 400 = 13600

**Paso 3:** Sumar: 13600 + 1360 + 136 = 15096

**Respuesta final:** 34 x 444 = 15096";

    let solution = AIEngine::parse_response(content, "34x444");

    assert_eq!(solution.steps.len(), 3);
    assert!(solution.steps[0].explanation.starts_with("Paso 1:"));
    assert!(solution.steps[1].explanation.contains("13600"));
    assert!(solution.final_answer.contains("15096"));
}

#[test]
fn test_with_transcription_uses_problema_line_for_drawings() {
    use crate::types::MathProblem;
    let problem = MathProblem { text: String::new(), image: Some("data:image/png;base64,AAAA".to_string()) };
    let content = "**Problema:** 3 x 10\n\nPaso 1: Multiplicamos\n\nRespuesta final: 30";
    let sol = AIEngine::with_transcription(AIEngine::parse_response(content, "Problema dibujado"), content, &problem);
    assert_eq!(sol.problem, "3 x 10");
}

/// Prueba real del modelo integrado: LOCAL_GGUF=/ruta/modelo.gguf cargo test -- --ignored
#[test]
#[ignore]
fn test_embedded_model_generates_solution() {
    let files = crate::ai::local::LocalModel {
        model: std::path::PathBuf::from(std::env::var("LOCAL_GGUF").expect("LOCAL_GGUF")),
        mmproj: std::env::var("LOCAL_MMPROJ").ok().map(std::path::PathBuf::from),
    };
    println!("dispositivo: {}", crate::ai::local::compute_device());
    let content = crate::ai::local::generate(&files, "Eres un profesor de matematicas.", "Resuelve paso a paso: 2x + 3 = 7", None, None)
        .expect("el modelo integrado debe responder");
    println!("{:.1} tokens/s\n{}", content.tokens_per_second, content.text);
    let content = content.text;
    assert!(content.contains('2'), "respuesta inesperada: {}", content);
}

/// Prueba real de vision: LOCAL_GGUF=... LOCAL_MMPROJ=... LOCAL_IMAGE=dibujo.png cargo test vision -- --ignored
#[test]
#[ignore]
fn test_embedded_vision_model_reads_drawing() {
    let files = crate::ai::local::LocalModel {
        model: std::path::PathBuf::from(std::env::var("LOCAL_GGUF").expect("LOCAL_GGUF")),
        mmproj: Some(std::path::PathBuf::from(std::env::var("LOCAL_MMPROJ").expect("LOCAL_MMPROJ"))),
    };
    let image = std::fs::read(std::env::var("LOCAL_IMAGE").expect("LOCAL_IMAGE")).unwrap();
    let content = crate::ai::local::generate(
        &files,
        "Eres un profesor de matematicas.",
        "La imagen contiene un problema de matematicas. Transcribelo en una linea que empiece con \"Problema:\" y resuelvelo.",
        Some(&image),
        None,
    ).expect("el modelo de vision debe responder");
    println!("dispositivo: {} ({:.1} tokens/s)\n{}", crate::ai::local::compute_device(), content.tokens_per_second, content.text);
    let content = content.text;
    assert!(content.contains("Problema:"), "respuesta inesperada: {}", content);
}

#[test]
fn test_strip_thinking_removes_reasoning_block() {
    let out = crate::ai::local::strip_thinking("<think>\nprimero pienso...\n</think>\n\nPaso 1: restar 3");
    assert_eq!(out, "Paso 1: restar 3");
    assert_eq!(crate::ai::local::strip_thinking("  Paso 1  "), "Paso 1");
}

#[test]
fn test_render_jinja_disables_thinking() {
    // Fragmento al estilo de la plantilla de Qwen3.5
    let tmpl = "{%- for m in messages %}{{- '<|im_start|>' + m.role + '\\n' + m.content + '<|im_end|>\\n' }}{%- endfor %}\
{%- if add_generation_prompt %}{{- '<|im_start|>assistant\\n' }}\
{%- if enable_thinking is defined and enable_thinking is false %}{{- '<think>\\n\\n</think>\\n\\n' }}{%- endif %}{%- endif %}";
    let prompt = crate::ai::local::render_jinja(tmpl, "sistema", "2+2", "", "").unwrap();
    assert!(prompt.contains("<|im_start|>user\n2+2<|im_end|>"));
    assert!(prompt.ends_with("<think>\n\n</think>\n\n"), "debe pedir respuesta directa: {:?}", prompt);
}

#[test]
fn test_transcription_on_following_lines() {
    let problem = crate::types::MathProblem { text: String::new(), image: Some("data:image/png;base64,AA==".into()) };
    let content = "Problema:  \nResuelve la ecuación:  \n3x + 4 = 19\n\n---\n\nx = 5";
    let solution = AIEngine::with_transcription(AIEngine::parse_response(content, "Problema dibujado"), content, &problem);
    assert_eq!(solution.problem, "Resuelve la ecuación: 3x + 4 = 19");
}

#[test]
fn test_parse_structured_solution() {
    let problem = crate::types::MathProblem { text: "2x + 3 = 7".into(), image: None };
    let content = r#"{"problema": "2x + 3 = 7", "pasos": [
        {"titulo": "Quitamos el 3", "explicacion": "Restamos 3 a los dos lados.", "operacion": "2x = 7 - 3 = 4"},
        {"titulo": "Dividimos entre 2", "explicacion": "Así x queda sola.", "operacion": ""}
    ], "respuesta_final": "x = 2"}"#;
    let s = AIEngine::parse_structured(content, &problem).expect("JSON valido");
    assert_eq!(s.problem, "2x + 3 = 7");
    assert_eq!(s.steps.len(), 2);
    assert_eq!(s.steps[0].title.as_deref(), Some("Quitamos el 3"));
    assert_eq!(s.steps[0].calculation.as_deref(), Some("2x = 7 - 3 = 4"));
    assert_eq!(s.steps[1].calculation, None, "operacion vacia no se escribe en la pizarra");
    assert_eq!(s.final_answer, "x = 2");
}

#[test]
fn test_parse_structured_rejects_free_text() {
    let problem = crate::types::MathProblem { text: "2+2".into(), image: None };
    assert!(AIEngine::parse_structured("Paso 1: sumamos\nRespuesta final: 4", &problem).is_none());
}

#[test]
fn test_solution_schema_converts_to_grammar() {
    let grammar = llama_cpp_2::json_schema_to_grammar(&AIEngine::solution_schema().to_string())
        .expect("el esquema debe convertirse en gramatica GBNF");
    assert!(grammar.contains("root"));
}

/// Explicacion estructurada real: LOCAL_GGUF=... cargo test structured -- --ignored --nocapture
#[test]
#[ignore]
fn test_embedded_model_structured_explanation() {
    let files = crate::ai::local::LocalModel {
        model: std::path::PathBuf::from(std::env::var("LOCAL_GGUF").expect("LOCAL_GGUF")),
        mmproj: None,
    };
    let grammar = llama_cpp_2::json_schema_to_grammar(&AIEngine::solution_schema().to_string()).unwrap();
    let problem = crate::types::MathProblem { text: std::env::var("PROBLEMA").unwrap_or("2x + 3 = 7".into()), image: None };
    let g = crate::ai::local::generate(&files, &AIEngine::system_prompt_for_tests(),
        &format!("Explica paso a paso como resolver este problema:\n\n{}", problem.text), None, Some(&grammar)).unwrap();
    println!("{:.1} tokens/s\n{}", g.tokens_per_second, g.text);
    let s = AIEngine::parse_structured(&g.text, &problem).expect("la gramatica garantiza JSON valido");
    for st in &s.steps {
        println!("[{}] {} | {:?}", st.step, st.title.clone().unwrap_or_default(), st.calculation);
    }
    println!("=> {}", s.final_answer);
}
