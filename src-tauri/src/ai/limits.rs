//! Limites de lo que el frontend puede mandar al modelo: el backend no confia en la ventana web
//! (un texto o una imagen enormes podrian agotar la memoria o tardar sin fin).

/// Caracteres de un problema escrito
pub const MAX_PROBLEM_CHARS: usize = 4_000;
/// Tamano de un dibujo como data URL (el PNG del lienzo pesa unos cientos de KB)
pub const MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;
/// Contexto de la pizarra que se manda con cada pregunta del chat
pub const MAX_CONTEXT_CHARS: usize = 20_000;
/// Caracteres de cada mensaje del chat
pub const MAX_MESSAGE_CHARS: usize = 2_000;

pub fn check_text(what: &str, text: &str, max: usize) -> Result<(), String> {
    if text.chars().count() > max {
        return Err(format!("{what} es demasiado largo (máximo {max} caracteres)"));
    }
    Ok(())
}

/// Un dibujo debe ser una imagen en data URL y no pasar del limite
pub fn check_image(image: &str) -> Result<(), String> {
    if image.len() > MAX_IMAGE_BYTES {
        return Err("El dibujo es demasiado grande".into());
    }
    if !image.starts_with("data:image/") {
        return Err("El dibujo no tiene un formato válido".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn texto_dentro_y_fuera_del_limite() {
        assert!(check_text("El problema", &"a".repeat(MAX_PROBLEM_CHARS), MAX_PROBLEM_CHARS).is_ok());
        let err = check_text("El problema", &"a".repeat(MAX_PROBLEM_CHARS + 1), MAX_PROBLEM_CHARS).unwrap_err();
        assert!(err.contains("demasiado largo"));
    }

    #[test]
    fn el_limite_cuenta_caracteres_no_bytes() {
        assert!(check_text("x", &"ñ".repeat(MAX_MESSAGE_CHARS), MAX_MESSAGE_CHARS).is_ok());
    }

    #[test]
    fn solo_acepta_imagenes_en_data_url_y_no_enormes() {
        assert!(check_image("data:image/png;base64,AAAA").is_ok());
        assert!(check_image("file:///etc/passwd").is_err());
        assert!(check_image("https://example.com/x.png").is_err());
        assert!(check_image(&format!("data:image/png;base64,{}", "A".repeat(MAX_IMAGE_BYTES))).is_err());
    }
}
