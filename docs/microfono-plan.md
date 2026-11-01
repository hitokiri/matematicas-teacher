# Plan: uso del micrófono (STT)

Objetivo: que el niño hable en vez de escribir. Fase 1 = chat; Fase 2 = operaciones en la pizarra por voz.

Estado: Fase 1 completa y liberada en `v0.4.9`. Fase 2 en curso (modo práctica liberado en `v0.5.0`): modelo de
operación, parser determinista y pizarra interactiva ya funcionan; falta la intención por LLM. En `v0.5.0` el micrófono
también dicta el problema en el cuadro de texto (`useMic.ts`, `claimMic`) y el chat ofrece ejemplos en la pizarra.

Lo que ya existe (base sobre la que construir):
- `sherpa-onnx 1.13.8` en Cargo.toml (hoy solo TTS: Piper/Kokoro en `src-tauri/src/voice/`).
- Patrón de descarga de modelos: `src-tauri/src/voice/download.rs` + `models/manager.rs`
  (tar.bz2 + sha256 + `.partial` reanudable + eventos de progreso).
- Chat: `src/components/StepChat.tsx` → `ask(question)` → `invoke('ask_about_steps')`.
- Settings.tsx ya escucha eventos (`model-download-complete`, `models-updated`).

## Fase 1 — micrófono en el chat (~1–2 días) — ✅ completa (v0.4.9)

Estado: STT local con Whisper funcionando, botón de micrófono en el chat y descarga de
modelos en Configuración. Implementado: `src-tauri/src/voice/stt.rs` (cpal + sherpa-onnx
Transcriber), `src/lib/mic.ts` (eventos `mic-state`/`mic-transcript`/`mic-error` y comandos
`start_listening`/`stop_listening`/`list_mic_models`), `MicSection.tsx` (descarga),
`StepChat.tsx` (dictado → pregunta, barge-in). Tests: vitest para la UI + `cargo test voice`
(2 tests ignorados: requieren modelo descargado con `STT_TEST_DIR`).

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

## Fase 2 — operaciones por voz (~2–3 días) — 🟡 en curso

Estado: modelo de operación + parser determinista + pizarra interactiva funcionando y
testeados. Falta la intención por LLM y pulir estilos/e2e.

Implementado:
- `src/lib/board/ops.ts`: `Operation` (sumar/restar/multiplicar/dividir ambos lados) +
  `applyOperation()` sobre `Lin`/`Equation` → `BoardStep` con la balanza; `isSolved`/`answerOf`.
- `src/lib/board/intent.ts`: `parseOperationIntent(transcript, lang)` — camino determinista
  (regex de frases comunes en es/en, números en dígitos o palabras); devuelve `null` si no
  se entiende.
- `src/components/PracticeBoard.tsx`: modo práctica — la pizarra crece paso a paso con cada
  operación dictada, la maestra confirma en voz alta y, si no se entiende o se divide entre 0,
  pregunta en vez de ejecutar.
- `Chalkboard.tsx` admite paso controlado desde afuera (`step`, `onStepDone`, `onStepMove`).
- `MainApp.tsx`: toggle "Practicar dictando" cuando el problema es una ecuación de primer grado.
- **Enrutado del dictado** (modo práctica): lo que se dice primero se intenta resolver en la pizarra
  (`boardFor`: cuentas, expresiones, fracciones, ecuaciones, sistemas); si no es un problema, se toma como
  operación; si nada se entiende, la maestra pregunta. En el chat, lo dictado ya no reemplaza la pizarra sin
  avisar: pasa por la pregunta "¿aquí o en la pizarra?" como cualquier otra pregunta.
- **Dueño del micrófono** (`mic.ts`): los eventos `mic-*` llegan a todos los suscriptores, así que `claimMic(owner)`
  marca quién lo activó (`chat`, `practice`, `problem`) y solo ese recibe el texto; se suelta con el `idle`
  que el backend envía siempre al final.
- **Micrófono junto al problema** (`useMic.ts` + `MainApp.tsx`): dicta al cuadro de texto, sin resolver solo.
- **Ids de trazo únicos** por operación (`applyOperation(..., idPrefix)`) y guion de la pizarra estable entre renders
  (si no, la narración se volvía a leer en cada render).
- Tests: `ops.test.ts`, `intent.test.ts`, `PracticeBoard.test.tsx`, `StepChat.test.tsx`, `problemTools.test.tsx`.

Pendiente:
1. **Intent por LLM**: pasar el transcript por el LLM local con un prompt de intención
   (utterance → `Operation` + parámetros), reutilizando `engine.rs`/`local.rs`, con el parser
   determinista como fallback.
2. Operaciones no lineales (elevar al cuadrado) y ecuaciones con la incognita a la derecha.
3. Estilos propios del modo práctica y cobertura e2e.
4. El texto del modo práctica (`PracticeBoard.tsx`) tiene frases escritas en el componente en vez de pasar por i18n.

## Riesgos

- Permisos de micrófono a nivel SO (Tauri no los gestiona; cpal los pide al abrir el stream).
- Whisper en CPU es lento en modelos grandes → elegir tamaño según hardware (la app ya distingue GPU/CPU).
- Voz infantil: Whisper small es el mínimo razonable para español.

## Orden sugerido

Fase 1 primero (chat) → validar latencia y precisión → Fase 2 (operaciones), que además
requiere el modo interactivo de la pizarra.
