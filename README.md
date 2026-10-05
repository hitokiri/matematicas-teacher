[Español](README.md) | [English](README.en.md)

# Matemáticas Teacher

Aplicación de escritorio (Tauri v2 + React/TypeScript) que enseña a niños a resolver problemas de matemáticas paso a paso en una pizarra animada, con balanza, pizzas y un chat para preguntar sobre cada paso. La inteligencia artificial corre **dentro de la app**, sin internet y sin servidores: los modelos se descargan una vez y se usan en la propia computadora.

## Características

- **Pizarra animada** con explicaciones paso a paso y pasos numerados.
- **Resolución simbólica propia** (sin modelo): cuentas, ecuaciones de primer grado, fracciones, raíces de cualquier índice y orden de operaciones — en `src/lib/board/`.
- **Visuales**: balanza para ecuaciones, pizzas y rectángulos para fracciones.
- **Chat de preguntas** sobre cada paso (`StepChat`).
- **Lienzo de dibujo**: lee lo que el niño escribe/dibuja con modelos con visión (mtmd) y permite corregirlo.
- **IA local con llama.cpp** integrado en la app (como Handy con whisper): sin servidor ni puertos; backends CPU/CUDA/Vulkan se cargan en tiempo de ejecución según el hardware.
- **Gestor de modelos** (Llama, Qwen, Phi, Gemma, Mistral): descarga desde HuggingFace, selección del modelo activo y eliminación.
- **Instaladores** `.deb` y AppImage (versiones con GPU NVIDIA y solo CPU) en `instaladores/`.

## Requisitos

| | Mínimo | Recomendado |
|---|---|---|
| Sistema | Linux x86_64 (probado en Ubuntu 24.04) | — |
| RAM | 8 GB | 16 GB o más |
| Disco | 5 GB libres (app + un modelo pequeño) | 20 GB (varios modelos) |
| GPU | No hace falta: funciona en CPU | NVIDIA con 8 GB de VRAM o más |

Sin GPU funciona igual, solo más lento (~15 s por explicación con un modelo de 2–3B). Con GPU NVIDIA la detecta sola al arrancar.

## Instalación

### Desde el instalador (lo más rápido)

Descarga el instalador (`.deb` o AppImage) de la página de *Releases* o de [`instaladores/`](instaladores/):

| Versión | Funciona en | Usa la GPU | Tamaño (.deb / AppImage) |
|---|---|---|---|
| **con-GPU-NVIDIA** | Cualquier PC | Sí, si hay NVIDIA con driver | ~520 MB / ~590 MB |
| **solo-CPU** | Cualquier PC | Nunca | ~20 MB / ~100 MB |

```bash
# Ubuntu / Debian
sudo apt install ./matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.deb

# Cualquier Linux (sin instalar)
chmod +x matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.AppImage
./matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.AppImage
```

- La versión con GPU también funciona en PCs sin GPU: si no detecta una NVIDIA, usa la CPU.
- El `.deb` instala el programa en `/usr/bin/matematicas-teacher` y aparece en el menú como **Matemáticas Teacher**.
- Ninguna versión incluye modelos: se descargan desde la app.

### Compilar desde el código

1. **Paquetes del sistema** (Ubuntu / Debian):

   ```bash
   sudo apt update
   sudo apt install -y build-essential curl wget file pkg-config cmake clang libclang-dev \
     libwebkit2gtk-4.1-dev libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev \
     patchelf libfuse2t64
   ```

2. **Rust** (rustup) y **Node.js 20 o superior**.

3. **CUDA** (opcional, solo con GPU NVIDIA): por defecto la app se compila con soporte CUDA, que
   requiere el CUDA Toolkit. Sin GPU, compila sin CUDA:
   `npm run tauri -- build -- --no-default-features --features custom-protocol`.

4. **Clonar y ejecutar**:

   ```bash
   git clone <url-del-repositorio> matematicas_teacher
   cd matematicas_teacher
   npm install
   npm run tauri dev
   ```

   La primera compilación tarda bastante (compila llama.cpp y, con CUDA, sus kernels: 10–30 min;
   sin CUDA, unos minutos). Las siguientes tardan segundos.

### Primer uso

1. Entra en **⚙️ Configuración** y descarga un modelo de la lista (todos leen dibujos).
2. Pulsa **Select**: pasa a *Active Model* y se carga en memoria.
3. Escribe o dibuja un problema en la pizarra.

### Dónde se guardan los datos

| Qué | Dónde |
|---|---|
| Modelos descargados | `~/.local/share/com.matematicas.teacher/models/` |
| Configuración | `~/.local/share/com.matematicas.teacher/settings.json` |

La app también encuentra modelos ya descargados en la caché de HuggingFace (`~/.cache/huggingface/hub`).

Guía completa (requisitos, problemas comunes, GitHub Actions): [docs/INSTALACION.md](docs/INSTALACION.md).

## Desarrollo

```bash
npm install
npm run tauri:dev     # app completa (frontend + backend Rust)
npm run dev           # solo el frontend (Vite, http://localhost:5173)
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Frontend con Vite |
| `npm run build` | `tsc` + `vite build` |
| `npm run test` | Tests unitarios (Vitest) |
| `npm run test:run` | Tests unitarios una vez |
| `npm run test:e2e` | Tests E2E (Playwright) |
| `npm run tauri:dev` | App Tauri en modo desarrollo |
| `npm run tauri:build` | Compilar la app |
| `npm run package:gpu` | Generar instaladores (.deb/AppImage) con backends GPU |
| `npm run package:cpu` | Generar instaladores solo CPU |

## Estructura

```
src/                  Frontend React (Vite + TypeScript)
  lib/board/          Solver simbólico: racional, fracciones, ecuaciones, expresiones
  components/         Chalkboard, BoardVisual, DrawingCanvas, StepChat, ModelBrowser, SolutionDisplay
  pages/              MainApp, Settings
src-tauri/            Backend Rust (Tauri v2)
  src/ai/             Motor de IA (llama.cpp, visión mtmd)
  src/models/         ModelManager: descarga/Selección/eliminación desde HuggingFace
scripts/              Empaquetado de librerías GPU/CPU y bundles
e2e/                  Tests Playwright
docs/INSTALACION.md   Guía de instalación y compilación
BITACORA.md           Bitácora del proyecto
```

## Licencia

LGPL-2.1 — ver [LICENSE](LICENSE).
