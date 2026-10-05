# Guía de instalación — Matemáticas Teacher

Aplicación de escritorio (Tauri + React) que enseña a niños a resolver problemas de matemáticas
paso a paso en una pizarra animada. La inteligencia artificial corre **dentro de la app**, sin
internet y sin servidores: los modelos se descargan una vez y se usan en la propia computadora.

> Esta guía es para **compilar y ejecutar desde el código**. El instalador de escritorio
> (`.deb` / AppImage) todavía no está listo; ver [Instalador de escritorio](#9-instalador-de-escritorio-estado).

---

## 1. Requisitos de la computadora

| | Mínimo | Recomendado |
|---|---|---|
| Sistema | Linux x86_64 (probado en Ubuntu 24.04) | — |
| RAM | 8 GB | 16 GB o más |
| Disco | 5 GB libres (app + un modelo pequeño) | 20 GB (varios modelos) |
| GPU | No hace falta: funciona en CPU | NVIDIA con 8 GB de VRAM o más |

- **Sin GPU** la app funciona igual, solo más lento: unos 15 s por explicación con un modelo de 2–3B.
- **Con GPU NVIDIA** la app la detecta sola al arrancar y la usa si el modelo cabe en su memoria.
  Con una RTX 5070 Ti el mismo modelo responde en 1–2 s.
- Las **cuentas, ecuaciones de primer grado, fracciones, raíces y orden de operaciones** las
  resuelve la app sin ningún modelo. El modelo solo se necesita para leer dibujos, para problemas con
  texto y para el chat de preguntas.

## 2. Herramientas para compilar

### 2.1 Paquetes del sistema (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install -y build-essential curl wget file pkg-config cmake clang libclang-dev \
  libwebkit2gtk-4.1-dev libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev
```

- `cmake`, `clang` y `libclang-dev` son para compilar **llama.cpp**, el motor de IA que va dentro de la app.
- El resto son los requisitos de Tauri.

### 2.2 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version   # probado con 1.99
```

### 2.3 Node.js 20 o superior

```bash
node --version    # probado con v22
npm --version
```

Si no lo tienes, instálalo con [nvm](https://github.com/nvm-sh/nvm) o desde https://nodejs.org.

### 2.4 CUDA (solo si tienes GPU NVIDIA)

Por defecto la app se compila **con soporte CUDA**, y para eso hace falta el CUDA Toolkit
(probado con CUDA 13.0):

```bash
# Ubuntu 24.04 (repositorio de NVIDIA)
sudo apt install -y cuda-toolkit-13-0
nvidia-smi                       # debe mostrar tu GPU
/usr/local/cuda/bin/nvcc --version
```

- La ruta de CUDA y las arquitecturas de GPU están en `src-tauri/.cargo/config.toml`: `CUDACXX`,
  `CUDA_PATH` y `CMAKE_CUDA_ARCHITECTURES`.
- Si tu CUDA está en otra ruta, exporta esas variables antes de compilar; tienen prioridad sobre el
  archivo.
- **Sin GPU NVIDIA o sin CUDA Toolkit**, compila sin CUDA (ver [sección 4](#4-compilar-sin-cuda)).

## 3. Descargar el código y ejecutar

```bash
git clone <url-del-repositorio> matematicas_teacher
cd matematicas_teacher
npm install
npm run tauri dev
```

- **La primera compilación tarda bastante:** compila llama.cpp y, con CUDA, sus kernels para GPU.
  Con CUDA son entre 10 y 30 minutos según la máquina; sin CUDA, unos minutos. Las siguientes tardan
  segundos.
- `npm run tauri dev` abre la ventana de la app y la recarga sola cuando cambias el código.

## 4. Compilar sin CUDA

En computadoras sin GPU NVIDIA, o sin el CUDA Toolkit instalado:

```bash
# desarrollo
npm run tauri -- dev -- --no-default-features

# compilacion de produccion
npm run tauri -- build -- --no-default-features --features custom-protocol
```

La app funciona igual, solo con CPU.

## 5. Primer uso

1. Abre la app y entra en **⚙️ Configuración**.
   - Arriba se ve el **hardware detectado**, por ejemplo "GPU: NVIDIA GeForce RTX 5070 Ti" o "CPU".
2. **Descarga un modelo** de la lista. Todos leen dibujos.
   - **⭐ Recomendado para tu PC:** es el de mejor puntaje de matemáticas que cabe en tu GPU; sin GPU,
     uno ligero.
   - **Cada tarjeta muestra:**
     - el puntaje de matemáticas publicado por el autor (MATH-Vision o MathVista)
     - después de usarlo, la velocidad medida en tu PC
   - **Como guía:**
     - **Pequeños** (Qwen 3.5 2B, Gemma 4 E2B): cualquier PC.
     - **Medianos** (Qwen 3.5 4B, Qwen 3 VL 4B): buen equilibrio; leen bien la letra a mano.
     - **Grandes** (Qwen 3.5 9B, Gemma 4 12B): necesitan GPU de 8–12 GB; explican mejor.
     - **Muy grandes** (Gemma 4 26B, Qwen 3.5 35B): se reparten entre GPU y RAM; necesitan 32 GB de RAM.
3. Pulsa **Select** en el modelo descargado: pasa a "Active Model" y se carga en memoria.
4. Vuelve con **← Volver** y escribe o dibuja un problema.

### Qué hace cada parte

- **✏️ Texto:** escribe por ejemplo `10 x 20`, `2x + 4 = 10`, `1/2 + 1/4 + 10` o
  `raiz cubica de 3x4+7`. La app lo resuelve en la pizarra con el método de la escuela:
  - multiplicación en columna
  - balanza para ecuaciones
  - pizzas para fracciones
  - raíces por tanteo
- **🎨 Dibujar:** el modelo lee el dibujo y muestra **"Leí esto en tu dibujo"**. Si leyó mal un
  número (por ejemplo una x que era un 7), corrígelo ahí y pulsa **Resolver esto**.
- **Pizarra:**
  - los pasos aparecen numerados y se pueden reproducir, pausar o recorrer con ◀ ▶
  - 🔈 lee en voz alta si el sistema lo permite
- **💬 Preguntas:** a la derecha de la pizarra. Pregunta por cualquier paso, o pulsa el número de un
  paso en la pizarra para preparar la pregunta.

## 6. Dónde se guardan los datos

| Qué | Dónde |
|---|---|
| Modelos descargados | `~/.local/share/com.matematicas.teacher/models/` |
| Configuración (modelo activo, velocidades) | `~/.local/share/com.matematicas.teacher/settings.json` |

- **Modelos ya bajados:** la app también encuentra los que ya tengas en la caché de Hugging Face
  (`~/.cache/huggingface/hub`), así que no hace falta volver a bajarlos.
- **Descargas interrumpidas:** quedan como `.partial` y se reanudan al volver a pulsar Download.

## 7. Pruebas

```bash
npm run test:run          # pruebas unitarias (vitest)
npm run test:e2e          # pruebas de la interfaz (Playwright, usa el puerto 5173)
cd src-tauri && cargo test   # pruebas de Rust
```

Pruebas con un modelo real (opcionales, marcadas `#[ignore]`):

```bash
cd src-tauri
M=~/.local/share/com.matematicas.teacher/models
LOCAL_GGUF=$M/Qwen3.5-2B-Q4_K_M.gguf cargo test embedded_model -- --ignored --nocapture
LOCAL_GGUF=$M/Qwen3VL-4B-Instruct-Q4_K_M.gguf LOCAL_MMPROJ=$M/mmproj-Qwen3VL-4B-Instruct-Q8_0.gguf \
  LOCAL_IMAGE=dibujo.png cargo test read_drawing -- --ignored --nocapture
```

## 8. Problemas comunes

| Problema | Solución |
|---|---|
| `No CMAKE_CUDA_COMPILER could be found` / no encuentra `nvcc` | Instala el CUDA Toolkit o ajusta `CUDACXX` en `src-tauri/.cargo/config.toml`. Si no tienes GPU NVIDIA, compila sin CUDA ([sección 4](#4-compilar-sin-cuda)). |
| `Unable to find libclang` | `sudo apt install libclang-dev` |
| La app dice "CPU" aunque tengas GPU | Revisa que `nvidia-smi` funcione. Si el modelo no cabe en la VRAM libre, la app usa CPU o reparte el modelo entre GPU y CPU; prueba un modelo más chico. |
| "Falta el archivo del modelo" | El archivo se borró o quedó incompleto: bórralo en Configuración y vuelve a descargarlo. |
| "El modelo activo no puede leer dibujos" | Selecciona un modelo de la lista actual (todos leen dibujos). |
| `npm run test:e2e`: "localhost:5173 is already used" | Tienes `npm run tauri dev` abierto en ese puerto; ciérralo antes de las pruebas. |
| La primera compilación es muy lenta | Es normal: compila llama.cpp y CUDA. Se hace una sola vez. |

## 9. Instalador de escritorio (estado)

`npm run tauri build` **todavía no genera un instalador que funcione en otra computadora**. Falta:

1. **Incluir las librerías de llama.cpp en el paquete.**
   - Qué son: `libllama.so`, `libggml*.so`, `libmtmd.so` y la carpeta `backends/` (CPU y CUDA).
   - Hoy se copian junto al ejecutable solo en `src-tauri/target/<perfil>/` para desarrollo; el `.deb`
     y la AppImage no las llevan.
2. **Iconos de la app.** `tauri.conf.json` tiene `"icon": []`; hay que generarlos con `npx tauri icon`.
3. **Decidir qué hacer con CUDA en el instalador.**
   - El módulo CUDA necesita `libcudart` y `libcublas` en la PC de destino: hay que incluirlas en el
     paquete, que crece varios cientos de MB, o pedirle al usuario que instale CUDA.
   - Sin ellas la app funciona igual en CPU.
4. Probar el instalador en una computadora limpia, con y sin GPU.
