use std::path::{Path, PathBuf};

fn main() {
    copy_llama_libs();
    tauri_build::build()
}

/// llama.cpp se compila como librerias compartidas (dynamic-backends). Se copian junto al
/// ejecutable (target/<perfil>/) con los modulos de backend en `backends/`, y se fija el
/// RUNPATH a `$ORIGIN` para que la app arranque sin `cargo` y se pueda empaquetar.
fn copy_llama_libs() {
    let Ok(backends) = std::env::var("DEP_LLAMA_BACKENDS_DIR") else { return };
    let backends = PathBuf::from(backends);
    println!("cargo:rerun-if-changed={}", backends.display());
    let Some(lib_dir) = backends.parent().map(|out| out.join("lib")) else { return };

    // OUT_DIR = target/<perfil>/build/<paquete>/out
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let Some(profile_dir) = out_dir.ancestors().nth(3) else { return };

    copy_shared_libs(&lib_dir, profile_dir);
    copy_shared_libs(&backends, &profile_dir.join("backends"));

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux") {
        println!("cargo:rustc-link-arg-bins=-Wl,-rpath,$ORIGIN");
    }
}

fn copy_shared_libs(from: &Path, to: &Path) {
    let Ok(entries) = std::fs::read_dir(from) else { return };
    let _ = std::fs::create_dir_all(to);
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.contains(".so") || name_str.ends_with(".dll") || name_str.ends_with(".dylib") {
            // fs::copy sigue los symlinks (libllama.so.0 -> libllama.so.0.x.y)
            let _ = std::fs::copy(entry.path(), to.join(&name));
        }
    }
}
