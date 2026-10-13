use super::*;

#[test]
fn wav_tiene_encabezado_y_tamano_correctos() {
    let wav = wav_bytes(&[0.0, 1.0, -1.0, 2.0], 22050);
    assert_eq!(&wav[0..4], b"RIFF");
    assert_eq!(&wav[8..12], b"WAVE");
    assert_eq!(wav.len(), 44 + 8);
    assert_eq!(u32::from_le_bytes(wav[24..28].try_into().unwrap()), 22050);
    assert_eq!(i16::from_le_bytes(wav[46..48].try_into().unwrap()), 32767);
    assert_eq!(i16::from_le_bytes(wav[48..50].try_into().unwrap()), -32767);
    // fuera de rango se recorta, no da la vuelta
    assert_eq!(i16::from_le_bytes(wav[50..52].try_into().unwrap()), 32767);
}

#[test]
fn las_voces_apuntan_a_un_paquete_conocido() {
    for v in VOICES.iter() {
        assert!(find_pack(v.pack.id).is_some());
        assert!(v.pack.url.starts_with("https://"));
        assert_eq!(v.pack.sha256.len(), 64);
    }
    assert!(find_voice("no-existe").is_none());
}

#[test]
fn un_paquete_a_medias_no_cuenta_como_instalado() {
    let dir = tempfile::tempdir().unwrap();
    assert!(!is_installed(dir.path(), &PIPER));
    std::fs::create_dir_all(pack_path(dir.path(), &PIPER)).unwrap();
    assert!(!is_installed(dir.path(), &PIPER));
    std::fs::write(pack_path(dir.path(), &PIPER).join("tokens.txt"), "x").unwrap();
    assert!(is_installed(dir.path(), &PIPER));
}

#[test]
fn rechaza_texto_vacio_o_demasiado_largo() {
    let dir = tempfile::tempdir().unwrap();
    let v = find_voice("piper-claude").unwrap();
    assert!(engine::synthesize(dir.path(), v, "  ").is_err());
    assert!(engine::synthesize(dir.path(), v, &"a".repeat(MAX_TEXT_CHARS + 1)).is_err());
    assert!(engine::synthesize(dir.path(), v, "hola").is_err()); // sin descargar
}

/// Prueba real con los modelos descargados: `VOICE_TEST_DIR=<carpeta voices> cargo test voz_real -- --ignored`
#[test]
#[ignore]
fn voz_real_genera_audio_con_piper_y_kokoro() {
    let dir = std::path::PathBuf::from(std::env::var("VOICE_TEST_DIR").expect("VOICE_TEST_DIR"));
    for id in ["piper-claude", "kokoro-dora", "kokoro-alex"] {
        let v = find_voice(id).unwrap();
        let wav = engine::synthesize(&dir, v, "Dos equis más tres ye igual a seis.").unwrap();
        assert!(wav.len() > 20_000, "{id}: audio demasiado corto ({} bytes)", wav.len());
        std::fs::write(dir.join(format!("{id}.wav")), wav).unwrap();
    }
}
