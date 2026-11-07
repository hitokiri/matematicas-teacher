# Actualización desde la app — como Handy

Objetivo: al abrir la app (o periódicamente), consultar si hay una versión nueva,
descargarla, "instalarla", reiniciar y arrancar ya con la nueva versión — el mismo
flujo que hace Handy (cjpais/Handy).

## Estado actual

- Plugins `tauri-plugin-updater` y `tauri-plugin-process` registrados en `src-tauri/src/main.rs`;
  capabilities `updater:default` y `process:default`.
- `tauri.conf.json` → `plugins.updater` con `endpoints` al `latest.json` del último Release.
  `pubkey` es la clave pública de `~/.tauri/matematicas-teacher.key..pub` (la privada nunca va al repo).
- Ajustes → *Actualización* (`src/components/UpdateSection.tsx`): versión instalada,
  buscar, descargar con progreso e instalar + reiniciar. Los errores van al registro (`updater`).
  El chequeo es manual (no hay chequeo automático al iniciar).
- Los artefactos del updater (`.sig`, `.app.tar.gz` en macOS) solo se generan si existe
  `TAURI_SIGNING_PRIVATE_KEY` (lo decide `scripts/stage-libs.mjs`); sin la llave, el empaquetado
  local funciona igual pero no produce firmas.
- CI firma con los secrets `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  y `scripts/build-latest-json.mjs` arma `latest.json`, que se sube al Release.
- Linux genera **solo AppImage** (el `.deb` se retiró); el updater no soporta `.deb`.

### Claves de plataforma en `latest.json`

| Clave | Archivo |
|---|---|
| `linux-x86_64` | `..._amd64_con-GPU-NVIDIA.AppImage` |
| `linux-x86_64-cpu` | `..._amd64_solo-CPU.AppImage` (la app CPU la fija con `Builder::target`) |
| `darwin-aarch64` | `..._arm64_macOS.app.tar.gz` (no el `.dmg`) |
| `windows-x86_64` | `..._x64_Windows.exe` (NSIS) |

### Para activarlo (una sola vez)

1. `npx tauri signer generate -w ~/.tauri/matematicas-teacher.key`
2. Copiar la clave pública (`.key.pub`) a `plugins.updater.pubkey` en `tauri.conf.json`.
3. En GitHub → Settings → Secrets: `TAURI_SIGNING_PRIVATE_KEY` (contenido de la privada) y
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
4. El Release no debe ser draft ni prerelease: el endpoint usa `releases/latest`.

## Arquitectura de Handy (referencia)

1. `tauri.conf.json` → `plugins.updater` con `pubkey` minisign y `endpoints` al manifiesto.
2. Capabilities: `updater:default` + `process:default` (para `relaunch()`).
3. Frontend `UpdateChecker.tsx`: `check()` de `@tauri-apps/plugin-updater`,
   `downloadAndInstall()` con eventos de progreso, `relaunch()` de `@tauri-apps/plugin-process`;
   toggle `update_checks_enabled`.
4. Workflow de release: compila, firma artefactos con `TAURI_SIGNING_PRIVATE_KEY` (minisign),
   genera `latest.json` y lo sube al Release de GitHub.

## Flujo de la app

1. Al iniciar, `check()` contra el endpoint.
2. Si hay versión mayor → banner/modal en Ajustes con `notes` (changelog del Release).
3. El usuario acepta → `downloadAndInstall()` con progreso.
4. Al terminar → `relaunch()`; la app arranca con la nueva versión.
5. Chequeo opt-in (la app es offline-first) y opcional "reiniciar cuando esté listo".

## Pasos de implementación

### Backend / config

- `src-tauri/Cargo.toml`: `tauri-plugin-updater = "2"` y `tauri-plugin-process = "2"`.
- `package.json`: `@tauri-apps/plugin-updater` y `@tauri-apps/plugin-process`.
- `tauri.conf.json` → `plugins.updater`: `pubkey` (la privada va como secret
  `TAURI_SIGNING_PRIVATE_KEY`), `endpoints` al `latest.json`, `version` alineada con el Release,
  `createUpdaterArtifacts: true`.
- `src-tauri/capabilities/default.json`: añadir `updater:default` y `process:default`.

### CI (`.github/workflows/instaladores.yml`)

- Par de llaves minisign una vez; la privada como secret.
- Tras `tauri build`, el build emite `*.sig` por artefacto.
- Ensamblar `latest.json` con la forma del updater, mapeando cada plataforma (y variante
  GPU/CPU) a su `signature` + `url` de descarga del Release.
- Publicar `latest.json` (asset del Release o rama `releases`) para que el endpoint lo sirva.

### Frontend

- `src/lib/updater.ts`: `check()`, `downloadAndInstall()`, `relaunch()`.
- UI en Ajustes reutilizando el patrón de `listen()` de eventos de descarga que ya existe.

## Por plataforma (el "instalar" real)

- **Linux (AppImage):** el updater aplica el parche vía `zsync` si existe `.zsync`; si no,
  descarga el AppImage completo y lo reemplaza. El `relaunch()` reabre el nuevo AppImage
  (hay que cerrar el proceso actual antes de abrir el nuevo).
- **macOS:** reemplaza el `.app` y relanza. Con firma ad-hoc es frágil para el updater.
- **Windows:** ejecuta el instalador NSIS y relanza.

## Riesgos / notas

- La firma minisign es obligatoria para el plugin oficial; sin secret el updater no funciona.
- El endpoint debe servir JSON válido y versionado; si apunta a un Release viejo, `check()`
  no encuentra nada.
- Mantener `version` en `tauri.conf.json` y `package.json` sincronizados con el Release.

## Estimación: ~1–2 días (8–12 h)

- 2–4 h: plugins `updater`+`process` (Cargo + npm), pubkey+endpoint en conf, capabilities,
  sección en Ajustes.
- 2–3 h: keypair minisign, firma en CI, `latest.json`.
- 3–4 h: pruebas multiplataforma.

## Orden sugerido

1. Llaves minisign + `plugins.updater` + `updater:default`/`process:default`.
2. CI genera `latest.json` firmado.
3. `src/lib/updater.ts` + UI en Ajustes.
4. Probar con un Release de prueba (`v0.6.1`) antes de activar el chequeo automático.
