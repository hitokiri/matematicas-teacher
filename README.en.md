[English](README.en.md) | [Español](README.md)

# Matemáticas Teacher

A desktop app (Tauri v2 + React/TypeScript) that teaches kids to solve math problems step by step on an animated chalkboard, with a balance scale, pizzas, and a chat to ask questions about each step. The AI runs **inside the app**, with no internet and no servers: models are downloaded once and used on the own computer.

![A system of two equations solved step by step on the chalkboard](docs/capturas/sistema.png)

## Features

- **Animated chalkboard** with step-by-step explanations and numbered steps.
- **Own symbolic solver** (no model needed): arithmetic, order of operations, roots of any index, fractions, first-degree equations, equations with two letters, and systems of two equations — in `src/lib/board/`.
- **"How far can the teacher go?" panel**: shows which topics the app explains on its own, which go to the model, and what comes next.
- **One board at a time**: long solutions are split across several boards and you see one at a time (or all together, if you ask).
- **Visuals**: balance scale for equations, pizzas and rectangles for fractions.
- **Question chat** about each step (`StepChat`).
- **Drawing canvas**: reads what the child writes/draws using vision models (mtmd) and lets them correct it.
- **Local AI with llama.cpp** embedded in the app (like Handy with whisper): no server, no ports; CPU/CUDA/Vulkan backends are loaded at runtime depending on the hardware.
- **Model manager** (Llama, Qwen, Phi, Gemma, Mistral): download from HuggingFace, select the active model, and delete.
- **Installers**: `.deb` and AppImage (NVIDIA GPU and CPU-only builds) in `instaladores/`.

## What it can explain

The app solves **on its own** (no model, always correct, no skipped steps) up to **systems of two first-degree
equations**. Anything beyond that is explained by the local model, and the steps are worth checking. The same list
is shown inside the app in the *¿Hasta dónde llega la maestra?* panel (`src/lib/capabilities.ts`); when a new topic
is added, both places are updated.

| # | Topic | Examples | How it explains it | Solved by |
|---|---|---|---|---|
| 1 | Arithmetic | `47 + 38`, `156 entre 12`, `34 x 444` | Column method, with carrying and borrowing | ✔ The app |
| 2 | Order of operations | `3 + 4 × 2`, `(8 − 3)²`, `√50` | Step by step; non-exact roots by trial | ✔ The app |
| 3 | Fractions | `1/2 + 1/4`, `2/3 × 3/5`, `6/8` | With pizzas | ✔ The app |
| 4 | Equations with one letter | `2x + 4 = 10`, `2(x + 3) = 14` | With a balance scale, then checks the answer | ✔ The app |
| 5 | One equation with two letters | `2x + 3y = 6` | Solves for y and finds pairs, explaining why each number is chosen | ✔ The app |
| 6 | Systems of two equations | `x + y = 5` and `x − y = 1` (one per line) | Substitution when a letter stands alone; otherwise elimination | ✔ The app |
| 7 | Quadratic equations | `x² = 9`, `x² + 5x + 6 = 0` | — | 🤖 Model |
| 8 | Inequalities, letter in the denominator | `2x + 1 < 7`, `6/x = 2` | — | 🤖 Model |
| 9 | Word problems | "Ana tiene 3 dulces…" | — | 🤖 Model |

Systems are written with one equation per line (`;` or `, ` also work).

## Screenshots

| | |
|---|---|
| ![Topics panel](docs/capturas/temas.png) | ![Equation with a balance scale](docs/capturas/balanza.png) |
| **How far can the teacher go?** Clicking an example types it into the box. | **One-letter equation**: the scale shows what is removed from each side. |
| ![One board at a time](docs/capturas/pizarras.png) | ![Interface settings](docs/capturas/configuracion.png) |
| **One board at a time**: the *Pizarra N* buttons switch boards and *Ver todas* shows them together. | **Settings › Interface**: boards, autoplay, topics panel, and theme. |

Screenshots are generated with `npm run capturas` (Playwright with the e2e mocked backend) and saved to
`docs/capturas/`.

## Interface settings

In **⚙️ Configuración › 🎨 Interfaz** (saved on the computer):

- **Boards for long solutions**: *Una a la vez* (one at a time, the default, saves space) or *Todas juntas* (all
  together). On the board, the *Ver todas* / *Una a la vez* button changes it just for that problem.
- **Font size** of the board and the explanation: small, normal, large, or extra large. It can also be changed with
  the **A−** / **A+** buttons next to the board. Text no longer shrinks when a line is long: if it doesn't fit, the
  board scrolls sideways.
- **Autoplay the board** when solving.
- **Show "¿Hasta dónde llega la maestra?"** on the main screen.
- **Light or dark theme.**

## Coming soon

- **Quadratic equations** on the board (first `x² = 9`, then factoring and the quadratic formula).
- **Natural teacher voice** (offline): local neural voices instead of the robotic system voice. Users will pick a
  voice by size: Piper (~60 MB, fast on CPU) or Kokoro (~300 MB, more expressive). It will read math properly
  ("2x + 3y = 6" → "dos equis más tres ye igual a seis") and advance the board when each audio clip ends.
- **Problem history saved as fixtures**: each solved problem will be saved as a file (the text and the board
  script) to view it again later without solving it again. The same files will be used as fixtures in the tests,
  to check that an explanation does not change by accident.

## Requirements

| | Minimum | Recommended |
|---|---|---|
| OS | Linux x86_64 (tested on Ubuntu 24.04) | — |
| RAM | 8 GB | 16 GB or more |
| Disk | 5 GB free (app + one small model) | 20 GB (several models) |
| GPU | Not required: works on CPU | NVIDIA with 8 GB VRAM or more |

Without a GPU it works the same, just slower (~15 s per explanation with a 2–3B model). With an NVIDIA GPU it is auto-detected at startup.

## Installation

### From the installer (the quickest way)

Download the installer (`.deb` or AppImage) from the *Releases* page or from [`instaladores/`](instaladores/):

| Version | Works on | Uses GPU | Size (.deb / AppImage) |
|---|---|---|---|
| **con-GPU-NVIDIA** | Any PC | Yes, if an NVIDIA card with driver is present | ~520 MB / ~590 MB |
| **solo-CPU** | Any PC | Never | ~20 MB / ~100 MB |

```bash
# Ubuntu / Debian
sudo apt install ./matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.deb

# Any Linux (no install needed)
chmod +x matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.AppImage
./matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.AppImage
```

- The GPU version also works on PCs without a GPU: if no NVIDIA card is detected, it falls back to CPU.
- The `.deb` installs the program in `/usr/bin/matematicas-teacher` and shows up in the menu as **Matemáticas Teacher**.
- Neither version ships models: they are downloaded from within the app.

### Build from source

1. **System packages** (Ubuntu / Debian):

   ```bash
   sudo apt update
   sudo apt install -y build-essential curl wget file pkg-config cmake clang libclang-dev \
     libwebkit2gtk-4.1-dev libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev \
     patchelf libfuse2t64
   ```

2. **Rust** (rustup) and **Node.js 20 or newer**.

3. **CUDA** (optional, NVIDIA GPUs only): the app builds with CUDA support by default, which
   requires the CUDA Toolkit. Without a GPU, build without CUDA:
   `npm run tauri -- build -- --no-default-features --features custom-protocol`.

4. **Clone and run**:

   ```bash
   git clone <repo-url> matematicas_teacher
   cd matematicas_teacher
   npm install
   npm run tauri dev
   ```

   The first build takes a while (it compiles llama.cpp and, with CUDA, its kernels: 10–30 min;
   without CUDA, a few minutes). Subsequent builds take seconds.

### First use

1. Open **⚙️ Settings** and download a model from the list (all of them read drawings).
2. Click **Select**: it becomes the *Active Model* and is loaded into memory.
3. Type or draw a problem on the chalkboard.

### Where data is stored

| What | Where |
|---|---|
| Downloaded models | `~/.local/share/com.matematicas.teacher/models/` |
| Settings | `~/.local/share/com.matematicas.teacher/settings.json` |

The app also finds models already downloaded in the HuggingFace cache (`~/.cache/huggingface/hub`).

Full guide (requirements, common issues, GitHub Actions): [docs/INSTALACION.md](docs/INSTALACION.md) (Spanish).

## Development

```bash
npm install
npm run tauri:dev     # full app (frontend + Rust backend)
npm run dev           # frontend only (Vite, http://localhost:5173)
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Frontend with Vite |
| `npm run build` | `tsc` + `vite build` |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:run` | Unit tests once |
| `npm run capturas` | UI screenshots for the README (`docs/capturas/`) |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run tauri:dev` | Tauri app in dev mode |
| `npm run tauri:build` | Build the app |
| `npm run package:gpu` | Generate installers (.deb/AppImage) with GPU backends |
| `npm run package:cpu` | Generate CPU-only installers |

## Structure

```
src/                  React frontend (Vite + TypeScript)
  lib/board/          Symbolic solver: rational, fractions, equations, two letters, systems, expressions
  lib/capabilities.ts Topics the app explains ("¿Hasta dónde llega la maestra?" panel)
  lib/uiPrefs.ts      Interface preferences
  components/         Chalkboard, BoardVisual, LevelsPanel, UiPrefsSection, DrawingCanvas, StepChat, ModelBrowser
  pages/              MainApp, Settings
src-tauri/            Rust backend (Tauri v2)
  src/ai/             AI engine (llama.cpp, mtmd vision)
  src/models/         ModelManager: download/select/delete from HuggingFace
scripts/              GPU/CPU library staging and bundling; capturas/ generates the screenshots
e2e/                  Playwright tests
docs/INSTALACION.md   Installation and build guide (Spanish)
docs/capturas/        UI screenshots
BITACORA.md           Project log (Spanish)
```

## License

LGPL-2.1 — see [LICENSE](LICENSE).
