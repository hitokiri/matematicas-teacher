# Guía de instalación — Matemáticas Teacher

Aplicación de escritorio (Tauri + React) que enseña a niños a resolver problemas de matemáticas
paso a paso en una pizarra animada. La inteligencia artificial corre **dentro de la app**, sin
internet y sin servidores: los modelos se descargan una vez y se usan en la propia computadora.

> - **¿Solo quieres instalar la app?** Descarga el instalador (`.deb` o AppImage) de la página de
>   *Releases* del repositorio; ver [Instaladores](#9-instaladores-de-escritorio).
> - El resto de la guía explica cómo **compilarla desde el código**.

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
  libwebkit2gtk-4.1-dev libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev \
  patchelf libfuse2t64
```

- `cmake`, `clang` y `libclang-dev` son para compilar **llama.cpp**, el motor de IA que va dentro de la app.
- `patchelf` y `libfuse2t64` solo hacen falta para generar los instaladores.
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
npm run test:e2e          # pruebas de la interfaz (Playwright, usa su propio puerto, el 5174)
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
| `npm run test:e2e`: "localhost:5174 is already used" | Quedó abierto un servidor de pruebas anterior; ciérralo. Las pruebas ya no chocan con `npm run dev` / `npm run tauri dev` (puerto 5173). |
| La primera compilación es muy lenta | Es normal: compila llama.cpp y CUDA. Se hace una sola vez. |

## 9. Instaladores de escritorio

### ¿Hace falta una versión distinta para PCs con y sin GPU?

**No para que funcione:** la versión con GPU revisa al arrancar si hay una tarjeta NVIDIA con
driver. Si la hay, la usa; si no, el módulo de GPU no se carga y la app usa la CPU, sin hacer nada.
Hay dos versiones solo por el **tamaño de la descarga**:

| Versión | Funciona en | Usa la GPU | Tamaño (.deb / AppImage) |
|---|---|---|---|
| **con-GPU-NVIDIA** | Cualquier PC | Sí, si hay NVIDIA con driver | ~520 MB / ~590 MB |
| **solo-CPU** | Cualquier PC | Nunca | ~20 MB / ~100 MB |

- La versión con GPU pesa más porque incluye las librerías de CUDA (`libcudart`, `libcublas`,
  `libcublasLt`). Así no hay que instalar el CUDA Toolkit: basta con el driver de NVIDIA
  (`nvidia-smi` debe funcionar).
- Ninguna de las dos incluye modelos: se descargan desde la app.

### Instalar

```bash
# Ubuntu / Debian
sudo apt install ./matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.deb

# Cualquier Linux (sin instalar)
chmod +x matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.AppImage
./matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.AppImage
```

- El `.deb` instala el programa en `/usr/bin/matematicas-teacher` y sus librerías en
  `/usr/lib/matematicas-teacher/`.
- La app aparece en el menú como **Matemáticas Teacher**.

### Generar los instaladores en tu computadora

```bash
npm run package:gpu    # con GPU NVIDIA (necesita el CUDA Toolkit para compilar)
npm run package:cpu    # solo CPU
```

Los archivos quedan en `instaladores/`, con la versión en el nombre (`..._con-GPU-NVIDIA.deb`,
`..._solo-CPU.AppImage`). Cada comando hace estos pasos:

1. `scripts/clean-llama-libs.mjs`: borra copias viejas de las librerías de llama.cpp (evita un error
   al alternar entre las dos versiones).
2. `tauri build --no-bundle`: compila la app en modo *release*.
3. `scripts/stage-libs.mjs`: reúne las librerías de llama.cpp, los módulos de CPU y, en la versión
   con GPU, el de CUDA y sus librerías. Les ajusta las rutas de búsqueda (`patchelf`) y genera la
   lista de archivos del paquete.
4. `tauri bundle`: arma el `.deb` y la AppImage.
5. `scripts/collect-bundles.mjs`: los copia a `instaladores/` con el nombre de la versión.

### En GitHub (Actions)

| Workflow | Cuándo corre | Qué hace |
|---|---|---|
| `.github/workflows/pruebas.yml` | Cada *push* a `main` y cada *pull request* | Tipos, vitest, Playwright y `cargo test` (versión solo CPU) |
| `.github/workflows/instaladores.yml` | A mano (*Actions → Instaladores → Run workflow*) o al subir una etiqueta `v*` | Genera las dos versiones en paralelo y las sube como *artifacts*; con una etiqueta, también publica un *Release* |

Para publicar una versión:

```bash
git tag v0.1.0
git push origin v0.1.0
```

La versión con GPU tarda bastante en los servidores de GitHub (compila los kernels de CUDA para
varias generaciones de tarjetas), del orden de una a varias horas. La de CPU tarda unos minutos.

### Probado

- **Con GPU (`.deb` y AppImage) en una PC con RTX 5070 Ti:** el modelo se carga en la GPU y la app
  usa las librerías de CUDA del paquete; del sistema solo toma el driver.
- **Solo CPU:** funciona sin cargar nada de CUDA y elige sola la variante de CPU más rápida para el
  procesador (por ejemplo `zen4`).
- **Pendiente:** probar en una computadora limpia (sin CUDA Toolkit ni herramientas de compilación).

## 10. Funciones futuras

### Versiones para teléfonos y tablets (Android / iOS)

La idea es llevar la app a tabletas y teléfonos, donde dibujar el problema con el dedo o con un lápiz
es todavía más natural para un niño. Mucho de lo que ya existe sirve tal cual:

| Parte | Estado para móvil |
|---|---|
| Interfaz (React) | Se reutiliza. Habría que adaptar el diseño a pantallas chicas: la pizarra arriba y el chat abajo o en una pestaña. |
| Pizarra, balanza, pizzas y algoritmos (cuentas, ecuaciones, fracciones, raíces) | Se reutilizan sin cambios: son TypeScript y no dependen de la computadora. |
| Lienzo para dibujar | Ya usa *pointer events*, así que funciona con dedo y lápiz (Apple Pencil, S Pen). |
| Tauri | La versión 2 ya compila para Android e iOS (`tauri android init`, `tauri ios init`). |
| IA local (llama.cpp) | llama.cpp funciona en Android (CPU, y Vulkan/OpenCL en algunos teléfonos) y en iOS/iPadOS (GPU con Metal). Hay que compilar `llama-cpp-2` para esas plataformas. |
| Modelos | Hay que usar los pequeños (Qwen 3.5 2B, Gemma 4 E2B) por la memoria de los teléfonos, y avisar del tamaño de la descarga y del espacio libre. |

Pendientes principales:

1. Compilar llama.cpp para Android (NDK) e iOS (Metal) y probar la velocidad en equipos reales.
2. Diseño adaptable (*responsive*) de la pantalla principal, la pizarra y el chat.
3. Elegir el modelo recomendado según la memoria del teléfono o tableta.
4. Publicar en Google Play y App Store (cuentas de desarrollador, firma, revisión de tiendas).

### Otras ideas

- Versiones de escritorio para Windows y macOS (Tauri ya lo permite; en macOS la GPU sería Metal).
- Que la app compruebe las cuentas que escribe el modelo y marque las que estén mal.
- Más dibujos en la pizarra: objetos para contar en sumas y restas pequeñas, recta numérica,
  cuadrícula para multiplicar.
- Respuestas del chat que aparezcan palabra por palabra mientras el modelo escribe.
