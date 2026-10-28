# Plan: uso del micrófono (STT)

Objetivo: que el niño hable en vez de escribir. Fase 1 = chat; Fase 2 = operaciones en la pizarra por voz.

Lo que ya existe (base sobre la que construir):
- `sherpa-onnx 1.13.8` en Cargo.toml (hoy solo TTS: Piper/Kokoro en `src-tauri/src/voice/`).
- Patrón de descarga de modelos: `src-tauri/src/voice/download.rs` + `models/manager.rs`
  (tar.bz2 + sha256 + `.partial` reanudable + eventos de progreso).
- Chat: `src/components/StepChat.tsx` → `ask(question)` → `invoke('ask_about_steps')`.
- Settings.tsx ya escucha eventos (`model-download-complete`, `models-updated`).

## Fase 1 — micrófono en el chat (~1–2 días)

1. **STT local**: sherpa-onnx ya soporta Whisper (Transcriber) con modelos ONNX
   multilingües. Reutilizar el crate existente; si la binding Rust de Transcriber no
   compila, plan B: `whisper-rs` (whisper.cpp), como hace Handy (que usa GGUF del
   catálogo `handy-computer`). Nuevo `src-tauri/src/voice/stt.rs`: descarga del pack
   (mismo patrón `download::start`), `transcribe(pcm) -> String`.

### Modelos STT recomendados (del catálogo curado de Handy, CER en español)

| Modelo | es CER | CPU (x realtime) | Tamaño | Uso |
|---|---|---|---|---|
| Whisper Large v3 Turbo | 3.12 | 1.4x | 886 MB | default equilibrado |
| Cohere Transcribe | 3.97 | 4.3x | 2.4 GB | máxima precisión multilingüe |
| Whisper Large v3 | 2.70 | 1.0x | 1.7 GB | más preciso, lento en CPU |
| Parakeet Ultra (TDT v3) | 3.06 | 13.3x | 740 MB | rapidísimo, ideal variante GPU |
| Canary 1B v2 | 3.10 | 8.3x | 1.1 GB | rápido, GPU (CUDA) |
| Canary 180M Flash | 6.54 | 21.7x | 218 MB | opción ligera CPU |
| Whisper Small | 5.92 | 5.9x | 270 MB | mínimo aceptable para voz infantil |

Default sugerido: **Whisper Large v3 Turbo** en CPU y **Parakeet Ultra** en GPU
(Parakeet/Canary GGUF requieren CUDA; en CPU usar Whisper). Voz infantil: no bajar
de Small.
2. **Captura de audio**: `cpal` en Rust (confiable en Linux/Windows/macOS; getUserMedia
   en webkit2gtk es problemático). Grabar VAD-simple (silencio → stop) o botón hablar/dejar de hablar.
3. **Comandos**: `start_listening`, `stop_listening`, `transcribe_now` → emiten
   `mic-transcript` a la UI. `StepChat.ask()` recibe el transcript y lo trata como
   pregunta escrita (mismo flujo, sin cambios de prompt).
4. **Barge-in**: al detectar voz del niño, `stopSpeaking()` (ya existe el canal de
   interrupción en StepChat/Chalkboard).
5. **UI**: botón de micrófono en StepChat + toggle en Settings + descarga del modelo
   en la sección de voces (reutilizar VoiceSection). Estados: listo/grabando/transcribiendo.
6. **Tests**: vitest para la UI (mock de `mic-transcript`), Rust test con `VOICE_TEST_DIR`
   como `voz_real_genera_audio_con_piper_y_kokoro`.

## Fase 2 — operaciones por voz (~2–3 días)

1. **Modelo de operación**: hoy la pizarra genera scripts (`equationScript` en
   `src/lib/board/equation.ts`); falta un modo interactivo: definir `Operation`
   (sumar/restar a ambos lados, elevar al cuadrado, dividir…) + `applyOperation()` en `src/lib/board/`.
2. **Intent por voz**: pasar el transcript por el LLM local con un prompt de intención
   (utterance → `Operation` + parámetros), reutilizando `engine.rs`/`local.rs`.
   Fallback determinista: regex para frases frecuentes ("elevar al cuadrado", "restar 4").
3. **Feedback**: la maestra confirma la operación en voz alta y la pizarra la dibuja
   (mismos `BoardStep`/`visual`).
4. **Seguridad**: operación no reconocida → preguntar, no ejecutar.

## Riesgos

- Permisos de micrófono a nivel SO (Tauri no los gestiona; cpal los pide al abrir el stream).
- Whisper en CPU es lento en modelos grandes → elegir tamaño según hardware (la app ya distingue GPU/CPU).
- Voz infantil: Whisper small es el mínimo razonable para español.

## Orden sugerido

Fase 1 primero (chat) → validar latencia y precisión → Fase 2 (operaciones), que además
requiere el modo interactivo de la pizarra.
