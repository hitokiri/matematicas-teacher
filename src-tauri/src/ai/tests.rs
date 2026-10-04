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
    let path = std::path::PathBuf::from(std::env::var("LOCAL_GGUF").expect("LOCAL_GGUF"));
    let content = crate::ai::local::generate(&path, "Eres un profesor de matematicas.", "Resuelve paso a paso: 2x + 3 = 7")
        .expect("el modelo integrado debe responder");
    assert!(content.contains('2'), "respuesta inesperada: {}", content);
}
