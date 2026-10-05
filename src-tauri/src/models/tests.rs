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
    
    // Pequenos, medianos y grandes
    assert!(model_ids.contains(&"unsloth/Qwen3.5-2B-GGUF"));
    assert!(model_ids.contains(&"ggml-org/gemma-4-E2B-it-GGUF"));
    assert!(model_ids.contains(&"unsloth/Qwen3.5-4B-GGUF"));
    assert!(model_ids.contains(&"unsloth/Qwen3.5-9B-GGUF"));
    assert!(model_ids.contains(&"ggml-org/gemma-4-12b-it-GGUF"));
    assert!(model_ids.contains(&"unsloth/Qwen3.5-35B-A3B-GGUF"));
}

#[test]
fn test_model_info_has_correct_properties() {
    let mut manager = ModelManager::new();
    let models = manager.list_models();
    
    let qwen = models.iter()
        .find(|m| m.id == "unsloth/Qwen3.5-4B-GGUF")
        .expect("Deberia encontrar Qwen 3.5 4B");
    
    assert_eq!(qwen.name, "Qwen 3.5 4B");
    assert!(qwen.description.len() > 0);
    assert_eq!(qwen.filename, "Qwen3.5-4B-Q4_K_M.gguf");
    // El mmproj generico del repo se guarda con nombre propio para no chocar con otros modelos
    assert_eq!(qwen.mmproj_filename.as_deref(), Some("mmproj-Qwen3.5-4B-F16.gguf"));
    assert_eq!(qwen.mmproj_remote.as_deref(), Some("mmproj-F16.gguf"));
    assert_eq!(qwen.benchmark.as_deref(), Some("MATH-Vision 74.6%"));
    assert!(!qwen.is_downloaded);
    assert!(!qwen.is_active);
    assert_eq!(qwen.download_progress, 0.0);
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
fn test_all_models_read_drawings() {
    for model in ModelManager::get_default_models() {
        assert!(model.mmproj_filename.is_some(), "{} debe leer dibujos", model.name);
        assert!(model.benchmark.is_some(), "{} debe tener benchmark publicado", model.name);
    }
}

#[test]
fn test_mmproj_local_names_do_not_collide() {
    let models = ModelManager::get_default_models();
    let mut names: Vec<&str> = models.iter().filter_map(|m| m.mmproj_filename.as_deref()).collect();
    let total = names.len();
    names.sort();
    names.dedup();
    assert_eq!(names.len(), total, "cada modelo necesita su propio archivo mmproj en disco");
}

#[test]
fn test_recommended_model_fits_hardware() {
    let mut manager = ModelManager::new();
    let find = |models: &[crate::types::ModelInfo]| {
        models.iter().filter(|m| m.is_recommended).map(|m| m.id.clone()).collect::<Vec<_>>()
    };

    // Sin hardware detectado no se recomienda nada
    assert!(find(&manager.list_models()).is_empty());

    // GPU de 16 GB: el mejor benchmark que cabe entero (Gemma 4 26B A4B no cabe con el margen)
    manager.set_hardware(Some(16303.0), 32000.0);
    assert_eq!(find(&manager.list_models()), vec!["ggml-org/gemma-4-12b-it-GGUF".to_string()]);

    // GPU de 8 GB
    manager.set_hardware(Some(8192.0), 16000.0);
    assert_eq!(find(&manager.list_models()), vec!["unsloth/Qwen3.5-9B-GGUF".to_string()]);

    // Sin GPU: uno ligero que corra con soltura en CPU
    manager.set_hardware(None, 16000.0);
    assert_eq!(find(&manager.list_models()), vec!["unsloth/Qwen3.5-4B-GGUF".to_string()]);
}

#[test]
fn test_measured_speed_is_listed() {
    let mut manager = ModelManager::new();
    manager.record_speed("unsloth/Qwen3.5-2B-GGUF", 123.4);
    let models = manager.list_models();
    let m = models.iter().find(|m| m.id == "unsloth/Qwen3.5-2B-GGUF").unwrap();
    assert_eq!(m.tokens_per_second, Some(123.4));
}

#[test]
fn test_downloaded_model_in_models_dir_is_listed_and_selectable() {
    let dir = std::env::temp_dir().join(format!("mt-models-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let mut manager = ModelManager::new();
    manager.set_models_dir(dir.clone()).unwrap();

    let first = manager.list_models().remove(0);

    std::fs::write(dir.join(&first.filename), b"gguf").unwrap();
    if let Some(mmproj) = &first.mmproj_filename {
        std::fs::write(dir.join(mmproj), b"gguf").unwrap();
    }
    let listed = manager.list_models();
    let model = listed.iter().find(|m| m.id == first.id).unwrap();
    assert!(model.is_downloaded, "un GGUF en el directorio de la app debe verse como descargado");

    manager.select_model(&first.id).unwrap();
    assert_eq!(manager.get_active_model_path(), Some(dir.join(&first.filename)));
    let files = manager.get_active_local_model().expect("archivos del modelo activo");
    assert_eq!(files.mmproj, first.mmproj_filename.as_ref().map(|f| dir.join(f)));

    manager.delete_model(&first.id).unwrap();
    assert!(!dir.join(&first.filename).exists());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn test_vision_model_needs_mmproj_to_be_downloaded() {
    let dir = std::env::temp_dir().join(format!("mt-vision-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let mut manager = ModelManager::new();
    manager.set_models_dir(dir.clone()).unwrap();

    let vision = manager.list_models().into_iter()
        .find(|m| m.mmproj_filename.is_some())
        .expect("debe haber un modelo que lee dibujos");
    std::fs::write(dir.join(&vision.filename), b"gguf").unwrap();
    let listed = manager.list_models();
    assert!(!listed.iter().find(|m| m.id == vision.id).unwrap().is_downloaded,
        "sin el mmproj el modelo de vision no esta completo");

    std::fs::write(dir.join(vision.mmproj_filename.as_ref().unwrap()), b"gguf").unwrap();
    let listed = manager.list_models();
    assert!(listed.iter().find(|m| m.id == vision.id).unwrap().is_downloaded);

    manager.delete_model(&vision.id).unwrap();
    assert!(!dir.join(vision.mmproj_filename.as_ref().unwrap()).exists(), "borrar elimina tambien el mmproj");
    let _ = std::fs::remove_dir_all(&dir);
}
