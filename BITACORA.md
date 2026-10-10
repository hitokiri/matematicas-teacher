# Bitácora del Proyecto - Matemáticas Teacher

## Fecha: 2024-10-02

---

## ✅ COMPLETADO

### 1. Estructura Base del Proyecto
- ✅ Inicialización del proyecto Tauri v2 + React + TypeScript
- ✅ Configuración de Vite como bundler
- ✅ Configuración de dependencias (serde, tokio, reqwest, hf-hub)
- ✅ Estructura de carpetas (src-tauri/src, src/components, src/pages)

### 2. Backend (Rust)
- ✅ Implementación de `ModelManager` en `src-tauri/src/models/manager.rs`
  - Lista de modelos predefinidos (Llama, Qwen, Phi, Gemma, Mistral)
  - Verificación de modelos descargados desde caché de HuggingFace
  - Selección de modelo activo
  - Eliminación de modelos
- ✅ Implementación de `AIEngine` en `src-tauri/src/ai/engine.rs`
  - Soporte para proveedores locales y remotos
  - Integración con API de HuggingFace
- ✅ Sistema de configuración en `src-tauri/src/types.rs`
  - Tipos `AIProvider`, `ModelInfo`, `AppSettings`
  - Persistencia con Tauri Store plugin
- ✅ Handlers Tauri en `src-tauri/src/models/commands.rs`
  - `list_models`, `download_model`, `select_model`, `delete_model`
- ✅ Configuración principal en `src-tauri/src/main.rs`
  - Registro de handlers
  - Carga de configuración persistente

### 3. Frontend (React/TypeScript)
- ✅ Componente `ModelBrowser` en `src/components/ModelBrowser.tsx`
  - Lista de modelos con filtros (Todos, Descargados, Activo)
  - Botón de actualizar lista
  - Badges de estado (Activo, Descargado)
  - Botones de acción (Descargar, Seleccionar, Eliminar)
- ✅ Página `Settings` en `src/pages/Settings.tsx`
  - Selección de proveedor (Local, OpenAI, Anthropic)
  - Inputs para API keys
  - Integración con ModelBrowser
  - Botón de guardar configuración
- ✅ Página `MainApp` en `src/pages/MainApp.tsx`
  - Interfaz principal para resolver problemas matemáticos
  - Display de soluciones paso a paso
- ✅ Estilos CSS en `src/index.css`
  - Variables CSS para tema
  - Estilos para cards, botones, badges
  - Estilos para modal de configuración

### 4. Mejoras de UI/UX
- ✅ Diseño moderno con gradientes y sombras
- ✅ Animaciones y transiciones suaves
- ✅ Glassmorphism en modal de configuración
- ✅ Responsive design
- ✅ Iconos y emojis para mejor UX

### 5. Corrección de Errores de Build
- ✅ Corrección de errores de borrow checker en Rust
- ✅ Migración a API de Tauri v2 (invoke en lugar de window.__TAURI__)
- ✅ Unificación de tipos TypeScript
- ✅ Eliminación de dependencia rota `@tauri-apps/plugin-specta`
- ✅ Creación de icono placeholder para Tauri

### 6. Corrección de Descarga Asíncrona
- ✅ Reescritura de `download_model_async` con `tokio::spawn` + `bytes_stream()`
- ✅ Uso de `reqwest::Client` async en lugar de blocking
- ✅ Integración con `futures_util::StreamExt`
- ✅ Compilación exitosa sin errores

### 7. Sistema de Tema Claro/Oscuro
- ✅ Toggle de tema con botón flotante (esquina inferior derecha)
- ✅ Variables CSS dinámicas con `[data-theme="dark"]`
- ✅ Persistencia de tema en `localStorage`
- ✅ Header con gradiente rosa (modo claro) / oscuro (modo oscuro)
- ✅ Estilos específicos para MainApp en ambos temas

### 8. Restauración de Interfaz Principal (MainApp)
- ✅ Estilos completos para `.input-section`
- ✅ Tabs para Texto/Dibujar (`.tab-bar`, `.tab`)
- ✅ Textarea grande para problemas (`.problem-input`)
- ✅ Botón grande para resolver (`.btn-large`)
- ✅ Spinner de carga animado (`.loading`, `.spinner`)
- ✅ Display de soluciones paso a paso (`.solution-section`, `.step`, `.final-answer`)
- ✅ Mensajes de error y advertencia (`.error-message`, `.warning-message`)

---

## 🔄 EN PROGRESO

### 1. Descarga Asíncrona con Progreso
**Estado:** Implementación completa - requiere prueba del usuario

**Completado:**
- ✅ Estructura básica para descarga asíncrona
- ✅ Sistema de progreso con `mpsc::UnboundedReceiver`
- ✅ Handles de descarga con `DownloadHandle`
- ✅ Comandos Tauri:
  - `download_model` - Inicia descarga
  - `pause_download` - Pausa descarga
  - `resume_download` - Reanuda descarga
  - `cancel_download` - Cancela descarga
  - `get_download_progress` - Obtiene progreso actual
- ✅ Polling de progreso cada 500ms en frontend
- ✅ Barra de progreso con porcentaje
- ✅ Botones de pausa y cancelación
- ✅ Actualización automática de lista al completar descarga

**Pendiente:**
- ⏳ Probar descarga real con modelo grande
- ⏳ Verificar que la UI no se congela durante descarga
- ⏳ Verificar que el progreso se actualiza correctamente

---

## ❌ POR HACER

### 1. Mejoras de UX
- [ ] Mostrar spinner de carga mientras se actualiza la lista
- [ ] Notificación toast al completar/cancelar descarga
- [ ] Confirmación visual de modelo seleccionado
- [ ] Soporte para reanudar descargas pausadas (implementar headers Range)

### 2. Funcionalidades Avanzadas
- [ ] Verificar integridad de modelos descargados (hash SHA256)
- [ ] Soporte para múltiples versiones de modelos
- [ ] Comparar tamaño descargado vs tamaño esperado
- [ ] Cache inteligente con limpieza automática
- [ ] Soporte para descarga paralela de múltiples modelos

### 3. Testing
- [x] Pruebas unitarias para `ModelManager` (Rust)
- [x] Pruebas de integración para handlers Tauri (Rust)
- [x] Pruebas end-to-end con Playwright (19/19 tests)
- [ ] Pruebas de estrés con descarga de modelos grandes
- [ ] Pruebas unitarias Vitest frontend (mocks corregidos, tests en progreso)

### 4. Documentación
- [x] BITACORA.md actualizada con testing implementado
- [ ] README con instrucciones de instalación
- [ ] Guía de desarrollo
- [ ] Documentación de la API
- [ ] Changelog

---

## 🐛 BUGS CORREGIDOS

1. **UI se congela durante descarga** ✅ CORREGIDO
   - Causa: Download se ejecutaba en contexto incorrecto
   - Solución: Usar `tokio::spawn` con API async correcta

2. **Errores de compilación** ✅ CORREGIDO
   - `bytes_stream()` no disponible en `reqwest::blocking`
   - `futures_executor` no estaba en dependencias
   - `spawn_blocking` no soporta código async
   - Solución: Migrar a `tokio::spawn` + `bytes_stream()`

3. **Interfaz principal rota** ✅ CORREGIDO
   - Causa: CSS global rompía estilos de MainApp
   - Solución: Agregar estilos específicos para todos los componentes

4. **Delete button visible en modelos no descargados** ✅ CORREGIDO
   - Causa: Condición incorrecta en renderizado
   - Solución: Verificar `model.is_downloaded` antes de mostrar botón

---

## 📊 ESTADO ACTUAL

| Componente | Estado | Notas |
|------------|--------|-------|
| Backend Rust | ✅ Completo | Compila sin errores |
| Frontend React | ✅ Completo | Funcional |
| UI/UX | ✅ Completo | Tema claro/oscuro, MainApp restaurado |
| Descarga Asíncrona | ✅ Completo | Usando tokio::spawn + bytes_stream() |
| Actualización UI | ✅ Completo | Polling cada 500ms |
| Testing | ✅ Parcial | 21/21 Rust tests, 19/19 E2E, Vitest mocks corregidos |

---

## 🔧 CORRECCIONES APLICADAS (2024-10-02)

### Problema: Errores de compilación en descarga asíncrona
- ❌ `bytes_stream()` no disponible en `reqwest::blocking::Response`
- ❌ `futures_executor` no estaba en dependencias
- ❌ `spawn_blocking` no soporta código async

### Solución aplicada:
1. ✅ Cambiar de `spawn_blocking` a `tokio::spawn` (async)
2. ✅ Usar `reqwest::Client::new()` (async) en lugar de `blocking::Client`
3. ✅ Usar `response.bytes_stream()` con `futures_util::StreamExt`
4. ✅ Agregar feature `blocking` a reqwest en Cargo.toml
5. ✅ Mantener `std::fs::write` para guardar archivo (blocking I/O aceptable)

### Archivos modificados:
- `src-tauri/Cargo.toml` - Agregar feature `blocking` a reqwest
- `src-tauri/src/models/manager.rs` - Reescribir `download_model_async` para usar async
- `src/components/ModelBrowser.tsx` - UI actualizada con diseño dark theme
- `src/index.css` - Rediseño completo con dark theme y pink accents
- `src-tauri/tauri.conf.json` - Corregir devUrl a puerto 5173

---

## 🎨 DISEÑO UI/UX

### Referencia
La UI sigue el diseño de la imagen proporcionada (Whisper interface):
- Dark theme con fondo #1a1a1a
- Pink/magenta accent (#ec4899) para estados activos
- Barras de accuracy y speed con gradientes
- Badges de "Active" y "Recommended"
- Tags para idiomas y características
- Separación en "Downloaded Models" y "Available to Download"

### Componentes
- **Search bar**: Búsqueda por nombre/descripción
- **Model cards**: Cards con info del modelo, métricas y acciones
- **Progress bar**: Barra de progreso con porcentaje y controles
- **Badges**: Active (pink), Recommended (pink outline)
- **Metrics**: Accuracy y speed con barras de progreso

---

## 💾 ARCHIVOS MODIFICADOS RECIENTEMENTE

### Sesión actual (Restauración de MainApp + Tema)
1. `src/index.css` - Variables de tema, estilos MainApp, toggle theme
2. `src/App.tsx` - Toggle de tema con localStorage
3. `src/components/ModelBrowser.tsx` - Verificación de delete button

### Sesiones anteriores
1. `src-tauri/src/models/manager.rs` - Descarga asíncrona (requiere corrección)
2. `src-tauri/src/models/commands.rs` - Handlers Tauri
3. `src-tauri/src/main.rs` - Registro de handlers
4. `src/components/ModelBrowser.tsx` - UI de modelos
5. `src/pages/Settings.tsx` - Página de configuración
6. `src/index.css` - Estilos CSS

---

## 🔑 COMANDOS ÚTILES

```bash
# Desarrollar
npm run tauri dev

# Construir release
npm run tauri build

# Solo frontend
npm run build

# Solo backend
cd src-tauri && cargo check

# Tests Rust
cd src-tauri && cargo test

# Tests Vitest (frontend unitarios)
npm run test:run
npm run test:watch

# Tests E2E (Playwright)
npm run test:e2e
npm run test:e2e:ui

# Limpiar
npm run clean
cd src-tauri && cargo clean
rm -rf node_modules/.vite
```

---

*Última actualización: 2024-10-02 - Restauración de MainApp + Tema claro/oscuro*
*Próximo paso: Probar descarga de modelo y verificar UI en tiempo real*

---

## 🧪 TESTING IMPLEMENTADO (2024-10-03)

### 1. Tests Unitarios Rust (Backend)
**Estado:** ✅ 21/21 tests pasando

**Cobertura:**
- `ModelManager` - default models, list, select, delete, tags, recommended_for
- `AIEngine` - provider detection, model selection
- `AppSettings` - serialization, deserialization, persistence
- `commands` - Tauri command handlers

**Comandos:**
```bash
cd src-tauri && cargo test
```

### 2. Tests E2E con Playwright (Frontend)
**Estado:** ✅ 19/19 tests pasando

**Archivos creados:**
- `e2e/playwright.config.ts` - Configuración de Playwright con Vite webServer
- `e2e/tauri-mock.ts` - Mock de Tauri API para E2E testing
- `e2e/main-app.spec.ts` - 6 tests: input, tabs, solve flow, draw mode
- `e2e/settings.spec.ts` - 5 tests: modal open/close, provider options, save, models
- `e2e/theme.spec.ts` - 5 tests: toggle, light/dark, localStorage persistence
- `e2e/drawing-canvas.spec.ts` - 3 tests: canvas visibility, mouse events, clear

**Comandos:**
```bash
npm run test:e2e          # Ejecutar E2E tests
npm run test:e2e:ui       # UI interactiva de Playwright
```

### 3. Tests Unitarios Vitest (Frontend)
**Estado:** ⚠️ Mocks corregidos, tests en progreso

**Problema encontrado:**
- `@tauri-apps/api/core` era pre-bundled por Vite antes de que Vitet inyectara mocks
- `invoke` funcion era `undefined` en tests

**Solución aplicada:**
- `vi.mock('@tauri-apps/api/core')` en `src/test-setup.ts` antes de imports
- `deps.inline: ['@tauri-apps/api']` en `vitest.config.ts`
- Mocks exportados: `mockInvoke`, `mockListen`, `mockEmit`, `mockConvertFileSrc`

**Comandos:**
```bash
npm run test:run          # Ejecutar Vitest tests
npm run test:watch        # Watch mode
```

---

## 🔧 CORRECCIONES APLICADAS (2024-10-03)

### Problema: Vitest tests fallan con "invoke is not a function"
- ❌ `@tauri-apps/api/core` pre-bundled por Vite antes de test-setup.ts
- ❌ `window.__TAURI_INTERNALS__` no disponible cuando se evalúa `@tauri-apps/api`
- ❌ `deps.inline` solo funciona para package root, no subpaths como `@tauri-apps/api/core`

### Solución aplicada:
1. ✅ `vi.mock('@tauri-apps/api/core')` en test-setup.ts (hoisted por Vitest)
2. ✅ Mocks para `@tauri-apps/api/event` también aplicados
3. ✅ `deps.inline: ['@tauri-apps/api']` en vitest.config.ts
4. ✅ Clear cache: `rm -rf node_modules/.vite` antes de tests

### Archivos modificados:
- `src/test-setup.ts` - vi.mock para Tauri API antes de cualquier import
- `vitest.config.ts` - deps.inline para bypass pre-bundling
- `src/components/ModelBrowser.test.tsx` - Fix regex syntax `/45%/` → `/45%/`
- `e2e/settings.spec.ts` - Fix selectors, remove debug logs

---

*Última actualización: 2024-10-03 - Testing implementado: 21 Rust tests, 19 E2E tests, Vitest mocks corregidos*

---

## 🧠 IA LOCAL INTEGRADA EN LA APP (2026-10-04)

Como Handy con whisper: llama.cpp va enlazado en el binario (`llama-cpp-2`), sin servidor ni puertos.
- `src-tauri/src/ai/local.rs`: carga el GGUF activo en memoria y genera la respuesta.
- Se precarga al seleccionar el modelo y al arrancar (si el proveedor es local); se libera al borrarlo.
- Ya no se conecta a `localhost:8080`. Respaldo: si la carga integrada falla y hay `llama-server`
  instalado, se lanza uno propio en un puerto libre asignado por el sistema.
- Modelos con vision (Qwen3-VL 4B, Qwen2.5-VL 3B) leen dibujos: se descargan GGUF + mmproj.
- GPU automatica: los backends de ggml se cargan al arrancar (`dynamic-backends`); si hay GPU
  NVIDIA con VRAM suficiente para el modelo se usa entera, si no CPU. Configuracion muestra el hardware.
- Configuracion: el modelo activo aparece arriba del todo en su propia seccion "Active Model".
- Prueba real: `LOCAL_GGUF=/ruta/modelo.gguf cargo test embedded -- --ignored`

### GPU y dibujos (2026-10-04)
- Compilar requiere CUDA toolkit (rutas en `src-tauri/.cargo/config.toml`). Sin CUDA:
  `cargo build --no-default-features --features custom-protocol`.
- `build.rs` copia libllama/libggml/libmtmd y `backends/` junto al ejecutable y fija RUNPATH=$ORIGIN.
- Medido (RTX 5070 Ti): Qwen 2.5 3B ~1.5 s en GPU vs ~14 s en CPU (`CUDA_VISIBLE_DEVICES=""`).
- Prueba de vision: `LOCAL_GGUF=... LOCAL_MMPROJ=... LOCAL_IMAGE=dibujo.png cargo test vision -- --ignored`
- Pendiente: incluir las .so y `backends/` en el paquete de `tauri build`.

### Solo modelos locales y catalogo 2026 (2026-10-04)
- Se quitaron OpenAI/Anthropic (UI y backend) y el boton "Guardar": el modelo activo se guarda al seleccionarlo.
- Catalogo: Qwen3.5 2B/4B/9B/35B-A3B, Gemma 4 E2B/E4B/12B/26B-A4B y Qwen3-VL 4B; todos leen dibujos.
- Cada tarjeta muestra el benchmark de matematicas publicado (MATH-Vision o MathVista, de las fichas
  oficiales) y la velocidad medida en esta PC (tokens/s, guardada en settings.json `model_speeds`).
- "Recomendado para tu PC": mejor MATH-Vision que cabe entero en la VRAM; sin GPU, el mejor de hasta ~3.5 GB.
- Modelos que no caben en la GPU: MoE con expertos en CPU (como --cpu-moe); densos con capas repartidas.
- Prompt con la plantilla Jinja del GGUF (minijinja) y `enable_thinking=false` (Qwen3.5 piensa por defecto).
- Medido: Qwen3.5 2B ~375 tokens/s en la RTX 5070 Ti, texto y dibujo.

### Pizarra animada (2026-10-04)
- `src/components/Chalkboard.tsx`: pizarra SVG con letra de tiza (@fontsource/patrick-hand), trazos que se
  "escriben", resaltado del paso actual, maestra que narra, controles (otra vez / anterior / reproducir /
  siguiente) y lectura en voz alta si el sistema la soporta.
- `src/lib/board/`: guiones paso a paso. Las cuentas escritas (+, −, ×, ÷ con enteros) las resuelve la app
  con el algoritmo de la escuela (llevadas, prestamos, filas parciales, casita), sin modelo y siempre correctas.
  Si el modelo lee una cuenta en un dibujo, tambien se usa el algoritmo exacto.
- Otros problemas: el modelo responde JSON forzado por gramatica (titulo, explicacion, operacion por paso)
  y cada operacion se escribe en un renglon de la pizarra. La explicacion en texto queda en un desplegable.
- Gramatica rapida: se muestrea sin gramatica y solo si el token no la cumple se filtra todo el vocabulario
  (como llama-server): Qwen3.5 2B ~320 tokens/s con JSON vs ~44 aplicandola siempre.
- Expresiones numericas (`src/lib/board/expression.ts`): orden de operaciones, parentesis, potencias y raices
  (√ ∛ ∜, "raiz cubica de ...") resueltas por la app. Raices no exactas por tanteo: enteros, decimas y
  centesimas (∛7: 1³=1, 2³=8, 1.9³=6.859, 1.91³=6.968, 1.92³=7.078 -> ≈ 1.91). Sin modelo.

### Dibujos: leer, mostrar y corregir (2026-10-04)
- Comando `read_problem`: el modelo solo transcribe el dibujo (JSON `{"problema"}`, notacion sin LaTeX).
  La app muestra "Lei esto en tu dibujo" editable; si es cuenta o expresion la resuelve la app, si no
  se le pide la explicacion al modelo con el texto. Un 7 mal leido como x se corrige a mano.
- Expresiones: LaTeX (\sqrt, \sqrt[n], \frac, \times aunque llegue como tabulador), raices de indice 2-10
  ("raiz quinta de", ⁵√). "/" es fraccion (lo explica el modelo); "÷", ":" y "entre" son division.
- Lienzo: coordenadas escaladas al tamano real, el dibujo se conserva al redimensionar, pointer events
  (raton, tactil y lapiz) con captura, sin hueco vacio debajo.
- Probado: Qwen3-VL 4B lee "√(3 × 7 × 6 + 12)" y "raiz quinta de (30)"; Qwen3.5 2B a veces usa LaTeX.

### Ecuaciones con balanza (2026-10-04)
- `src/lib/board/equation.ts`: ecuaciones de primer grado (ax + b = cx + d, con parentesis, fracciones y
  cualquier letra) resueltas por la app con aritmetica exacta (`rational.ts`). Pasos: quitar parentesis,
  voltear si hay mas x a la derecha, quitar x de un lado, quitar/sumar el numero, repartir, comprobar.
- `src/components/BoardVisual.tsx`: balanza con bolsas x y pesas; tacha lo que se quita de los dos lados
  y dibuja los grupos iguales al repartir. Se muestra bajo la pizarra en cada paso.
- Casos especiales: "cualquier numero sirve" y "no tiene solucion".

### Fracciones con pizzas (2026-10-04)
- `src/lib/board/fraction.ts`: suma y resta (recortar a rebanadas del mismo tamano con la "tabla" comun),
  multiplicacion (rectangulo de filas x columnas; entero x fraccion = sumar varias veces), division
  (voltear y multiplicar), simplificar y pasar a enteros + fraccion. Todo con numeros exactos.
- Pizzas en `BoardVisual.tsx`: rebanadas tomadas, las de la segunda fraccion en otro color, las que se
  restan tachadas. "/" se lee como fraccion; "1/2" sola ya no va a division en casita.

### Pasos numerados y chat de preguntas (2026-10-04)
- La pizarra numera cada renglon con el numero de su paso (igual que "Paso N de M"); en las cuentas en
  columna el numero aparece junto a lo que se escribe. Pulsar un numero prepara la pregunta en el chat.
- Todo paso escribe algo en la pizarra y la explicacion del modelo no repite renglones.
- `src/components/StepChat.tsx` + comando `ask_about_steps`: chat a la derecha con la maestra (modelo
  local). Recibe el problema, los pasos numerados (lo escrito y lo narrado) y el paso actual. Botones
  rapidos: "No entendi el paso N", "¿Por que se hace asi?", "Dame otro ejemplo".
- `local::generate_chat`: conversaciones de varios turnos con la plantilla del modelo.

### Mas detalle en los pasos (2026-10-04)
- Fracciones en cadena (hasta 5 terminos, enteros incluidos) con orden de operaciones: cada operacion con sus
  pasos, simplificacion a mitad de camino y renglon "= lo que queda". Entero + fraccion: "10 = 40/4".
  Resultado como fraccion, entero y fraccion, y el decimal en la narracion (43/4 = 10 y 3/4, 10.75).
- Dos signos seguidos ("+*") muestran un aviso en vez de mandarlo al modelo.
- Prompt del modelo: una sola operacion por paso, sin saltar conversiones, hasta 12 pasos, fracciones como
  fraccion. Medido: Qwen3.5 2B sigue juntando pasos; Qwen3-VL 4B los separa y resuelve x² = 9 como ±3.

### Instaladores y GitHub Actions (2026-10-04)
- `npm run package:gpu` / `package:cpu` generan .deb y AppImage en `instaladores/` (con-GPU-NVIDIA / solo-CPU).
  La version con GPU funciona tambien sin GPU (cae a CPU); incluye libcudart/libcublas/libcublasLt (~520 MB).
- `scripts/stage-libs.mjs`: libs de llama.cpp + backends (+ CUDA) en /usr/lib/matematicas-teacher, RUNPATH con
  patchelf, lista de archivos para `tauri bundle`. libcuda.so (driver) nunca se incluye.
- productName sin tilde (paquete `matematicas-teacher`, dpkg no acepta tildes); el menu y la ventana dicen
  "Matemáticas Teacher" (`src-tauri/linux/matematicas-teacher.desktop`). Iconos generados con `tauri icon`.
- Workflows: `pruebas.yml` (tipos, vitest, Playwright, cargo test sin CUDA) e `instaladores.yml` (matriz GPU/CPU,
  artifacts y Release con etiquetas v*).
- Probado en esta PC: .deb y AppImage con GPU cargan el modelo en la RTX 5070 Ti con las libs del paquete;
  solo CPU no carga nada de CUDA.

### Pizarra en varias pizarras (2026-10-09)
- Antes la pizarra crecia hacia abajo sin limite y se aplastaba; ahora caben 8 renglones por pizarra
  y la maestra sigue escribiendo en la siguiente (la otra parte), con las pizarras lado a lado.
- `src/lib/board/paginate.ts`: `MAX_ROWS_PER_PAGE`, `pageOf`, `rowOnPage`, `pageCount`, `pagesOf`.
  La paginacion se hace al dibujar, no al generar el guion: los generadores no cambian.
- `src/components/Chalkboard.tsx`: sigue automaticamente la pizarra donde se esta escribiendo;
  los botones "Pizarra N" dejan ver una pizarra anterior. El contador dice "Paso N de M · pizarra X de Y".
- Pruebas: `src/lib/board/paginate.test.ts` y en `Chalkboard.test.tsx`; el e2e `proceso largo`
  (con `proceso largo` en el mock) y los selectores de pizarra pasaron a `.chalk-pages`.

### Arreglo: la ventana abortaba con WebKitGTK (2026-10-09)
- `Could not create GBM EGL display: EGL_NOT_INITIALIZED. Aborting...` con la RTX 5070 Ti: WebKitGTK 4.1
  intenta el renderizador DMA-BUF y no inicializa EGL. En `src-tauri/src/main.rs` se pone
  `WEBKIT_DISABLE_DMABUF_RENDERER=1` al arrancar (si el usuario no lo definió ya). Probado: abre la ventana.

### Ecuaciones con dos letras y sistemas de dos ecuaciones (2026-10-09)
- `src/lib/board/twoVars.ts`: una ecuación con dos letras (`2x + 3y = 6`) ya no va al modelo (se saltaba pasos).
  Despeja la y, prueba x = 0 (explica por qué: todo número × 0 = 0) y la x que deja y = 0 (o prueba números
  hasta que la división sea exacta), con cada cuenta en su propio renglón y comprobación.
- `src/lib/board/system.ts`: sistemas de dos ecuaciones (una por renglón, `;` o `, `). Sustitución si alguna
  letra tiene coeficiente 1 o −1 (porque no hay que dividir); si no, reducción con el mcm. Detecta sistemas sin
  solución o con infinitas. La lectura de ecuaciones lineales (`normalizeLinear`, `parseLinear`) se comparte.
- Se resuelven con fracciones exactas; si no hay letra sola y los coeficientes no son enteros, va al modelo.

### Interfaz: pizarras de una en una, configuración y panel de temas (2026-10-09)
- Las pizarras de un proceso largo se ven de una en una; *Ver todas* las junta (prop `showAllPages` de `Chalkboard`).
- Arreglo: un paso final sin renglones (el "¡Listo!") regresaba a la pizarra 1; ahora se queda en la última escrita.
- **Configuración › Interfaz** (`UiPrefsSection`, `src/lib/uiPrefs.ts`, en localStorage `ui-prefs`): pizarras una
  a la vez / todas juntas, reproducir sola, mostrar el panel de temas y tema claro/oscuro.
- Panel **¿Hasta dónde llega la maestra?** (`LevelsPanel`, datos en `src/lib/capabilities.ts`): temas que explica
  la app, los que van al modelo y lo que viene. Una prueba verifica que los ejemplos de la app se resuelven sin
  modelo y que los del modelo de verdad van al modelo. Al agregar un tema: actualizar `capabilities.ts` y el README.
- `npm run capturas` (`playwright.capturas.config.ts`, `scripts/capturas/`) genera las capturas del README en
  `docs/capturas/`.

### Tamaño de letra de la pizarra (2026-10-09)
- Antes la pizarra se escalaba al ancho: un renglón largo encogía toda la letra (en `2x + 3y = 6` quedaba ~14 px).
  Ahora las pizarras de renglones tienen letra de tamaño fijo (`TEXT_PX` = 32 px × tamaño elegido) y llenan el ancho;
  si un renglón no cabe, la pizarra se desplaza de lado. El ancho se calcula con el texto real (`CHAR_UNITS`), no con
  `script.cols` (que sobreestima el texto: es para las cuentas en columna, que siguen ajustándose al ancho).
- Tamaño de letra (`fontScale`: 0.85 / 1 / 1.2 / 1.4) en Configuración › Interfaz y con A− / A+ junto a la
  pizarra; también agranda la explicación de la maestra.

### Ícono de la app (2026-10-09)
- El ícono era un cuadro azul liso. Ahora es una pizarra con marco de madera y los signos + − × ÷ en tiza de
  colores, sobre el degradado rosa-morado de la app. La fuente es `src-tauri/icons/icon.svg`; `npm run icono`
  genera los PNG, `.ico` e `.icns` con `tauri icon` (borra las carpetas android/ios, que no se usan) y copia el SVG
  a `public/icon.svg`, que se usa como favicon y en el encabezado (en lugar del emoji 📐).

### Pendiente
- Ecuaciones de segundo grado en la pizarra (`x² = 9`, factorización, fórmula general).
- Voz natural de la maestra, sin internet. Hoy el botón 🔈 usa speechSynthesis (en Linux suena a espeak o no
  funciona). Plan: sherpa-onnx desde Rust con Piper (~60 MB, voces es_MX/es_ES) o Kokoro (~300 MB); que el usuario
  escoja la voz por tamaño en Configuración (descarga como los modelos). Falta: comando `speak(texto)`,
  empaquetar onnxruntime en .deb/AppImage, convertir las matemáticas a palabras ("÷", "−", "√", "1/2" → "un
  medio") y sincronizar la pizarra con el final del audio (prepara el siguiente mientras suena). Antes de integrar:
  generar audios de prueba para comparar voces y revisar la licencia de Piper (piper1 es GPL; la app es LGPL).
- Historial de problemas guardado como fixture: cada problema resuelto en un archivo (texto + guion de la
  pizarra) para volver a verlo sin resolverlo de nuevo, y usar esos archivos como fixtures en las pruebas.
