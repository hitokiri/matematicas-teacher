use crate::models::ModelManager;

#[test]
fn test_new_model_manager_has_default_models() {
    let mut manager = ModelManager::new();
    let models = manager.list_models();
    assert!(!models.is_empty(), "El manager debe tener modelos por defecto");
    assert!(models.len() >= 6, "Debe haber al menos 6 modelos por defecto");
}

#[test]
fn test_list_models_returns_all_models() {
    let mut manager = ModelManager::new();
    let models = manager.list_models();
    
    let model_ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
    
    assert!(model_ids.contains(&"lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF"));
    assert!(model_ids.contains(&"bartowski/Qwen2.5-3B-Instruct-GGUF"));
    assert!(model_ids.contains(&"lmstudio-community/Phi-3.5-mini-instruct-GGUF"));
    assert!(model_ids.contains(&"bartowski/gemma-2-2b-it-GGUF"));
    assert!(model_ids.contains(&"lmstudio-community/Mistral-7B-Instruct-v0.3-GGUF"));
    assert!(model_ids.contains(&"bartowski/Qwen2.5-1.5B-Instruct-GGUF"));
}

#[test]
fn test_model_info_has_correct_properties() {
    let mut manager = ModelManager::new();
    let models = manager.list_models();
    
    let llama_model = models.iter()
        .find(|m| m.id == "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF")
        .expect("Deberia encontrar Llama 3.1");
    
    assert_eq!(llama_model.name, "Llama 3.1 8B Instruct");
    assert!(llama_model.description.len() > 0);
    assert_eq!(llama_model.filename, "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf");
    assert_eq!(llama_model.size_mb, 4915.0);
    assert!(!llama_model.is_downloaded);
    assert!(!llama_model.is_active);
    assert_eq!(llama_model.download_progress, 0.0);
}

#[test]
fn test_select_model_success() {
    let mut manager = ModelManager::new();
    
    if let Some(model) = manager.list_models().iter().next() {
        let result = manager.select_model(&model.id);
        assert!(result.is_err(), "Seleccionar modelo no descargado deberia fallar");
    }
}

#[test]
fn test_select_model_not_found() {
    let mut manager = ModelManager::new();
    let result = manager.select_model("non-existent-model-id");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("no encontrado"));
}

#[test]
fn test_delete_model_not_found() {
    let mut manager = ModelManager::new();
    let result = manager.delete_model("non-existent-model-id");
    assert!(result.is_err());
}

#[test]
fn test_get_active_model_no_active() {
    let manager = ModelManager::new();
    let active = manager.get_active_model();
    assert!(active.is_none(), "No deberia haber modelo activo por defecto");
}

#[test]
fn test_get_default_models_structure() {
    let models = ModelManager::get_default_models();
    
    for model in &models {
        assert!(!model.id.is_empty(), "Cada modelo debe tener un ID");
        assert!(!model.name.is_empty(), "Cada modelo debe tener un nombre");
        assert!(!model.description.is_empty(), "Cada modelo debe tener una descripcion");
        assert!(!model.filename.is_empty(), "Cada modelo debe tener un filename");
        assert!(model.size_mb > 0.0, "Cada modelo debe tener un tamano positivo");
        assert!(!model.tags.is_empty(), "Cada modelo debe tener tags");
    }
}

#[test]
fn test_models_have_recommended_for() {
    let models = ModelManager::get_default_models();
    
    for model in &models {
        assert!(!model.recommended_for.is_empty(), 
            "El modelo {} debe tener recommended_for", model.name);
    }
}

#[test]
fn test_model_tags_format() {
    let models = ModelManager::get_default_models();
    
    let qwen_1_5b = models.iter()
        .find(|m| m.id == "bartowski/Qwen2.5-1.5B-Instruct-GGUF")
        .expect("Deberia encontrar Qwen 2.5 1.5B");
    
    assert!(qwen_1_5b.tags.contains(&"ultra-ligero".to_string()));
    assert!(qwen_1_5b.tags.contains(&"1.5B".to_string()));
    assert!(qwen_1_5b.tags.contains(&"rapido".to_string()));
}

#[test]
fn test_model_recommended_for_categories() {
    let models = ModelManager::get_default_models();
    
    let qwen_1_5b = models.iter()
        .find(|m| m.id == "bartowski/Qwen2.5-1.5B-Instruct-GGUF")
        .expect("Deberia encontrar Qwen 2.5 1.5B");
    
    assert!(qwen_1_5b.recommended_for.contains(&"principiante".to_string()));
    assert!(qwen_1_5b.recommended_for.contains(&"aritmetica".to_string()));
    
    let llama = models.iter()
        .find(|m| m.id == "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF")
        .expect("Deberia encontrar Llama 3.1");
    
    assert!(llama.recommended_for.contains(&"matematicas".to_string()));
    assert!(llama.recommended_for.contains(&"logica".to_string()));
}

#[test]
fn test_downloaded_model_in_models_dir_is_listed_and_selectable() {
    let dir = std::env::temp_dir().join(format!("mt-models-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let mut manager = ModelManager::new();
    manager.set_models_dir(dir.clone()).unwrap();

    let first = manager.list_models().remove(0);

    std::fs::write(dir.join(&first.filename), b"gguf").unwrap();
    let listed = manager.list_models();
    let model = listed.iter().find(|m| m.id == first.id).unwrap();
    assert!(model.is_downloaded, "un GGUF en el directorio de la app debe verse como descargado");

    manager.select_model(&first.id).unwrap();
    assert_eq!(manager.get_active_model_path(), Some(dir.join(&first.filename)));

    manager.delete_model(&first.id).unwrap();
    assert!(!dir.join(&first.filename).exists());
    let _ = std::fs::remove_dir_all(&dir);
}
