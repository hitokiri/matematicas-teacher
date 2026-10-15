#!/usr/bin/env node
// Reune las librerias que necesita la app instalada y genera la configuracion de Tauri que las
// incluye en el paquete, en la carpeta donde la app las busca al arrancar:
//   - Linux (.deb / AppImage): en /usr/lib/matematicas-teacher/
//   - macOS (.app / .dmg): en Contents/Resources/ (el binario las busca con @rpath)
//   - Windows (.exe NSIS): junto al ejecutable (el loader de Windows busca las DLL ahi); sin rpath
//   - llama.cpp: libllama, libggml*, libmtmd (compartidas, porque los backends son dinamicos)
//   - voz de la maestra: libsherpa-onnx-c-api y libonnxruntime
//   - backends/: modulos de CPU (todas las variantes), CUDA (Linux con GPU) y Metal (macOS)
//   - Linux con GPU: las librerias de CUDA que usa el modulo (libcudart, libcublas, libcublasLt),
//     para que funcione sin instalar el CUDA Toolkit. Solo hace falta el driver de NVIDIA.
//
// Uso: node scripts/stage-libs.mjs [--gpu]   (despues de `tauri build --no-bundle`)

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const gpu = process.argv.includes('--gpu')
const darwin = process.platform === 'darwin'
const win = process.platform === 'win32'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const release = path.join(root, 'src-tauri', 'target', 'release')
const stage = path.join(release, 'lib-bundle')

const fail = msg => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

if (!fs.existsSync(release)) fail(`No existe ${release}: primero ejecuta "tauri build --no-bundle"`)
fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(path.join(stage, 'backends'), { recursive: true })

const base = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'))
const out = path.join(release, 'bundle-files.json')

// ---- macOS: los .dylib se copian dentro del .app y se arreglan con install_name_tool ----
if (darwin) {
  const staged = new Set()
  const libs = fs.readdirSync(release).filter(f => /^lib(llama|ggml|mtmd)[\w-]*\.dylib$/.test(f))
  // llama.cpp va enlazado de forma estatica en macOS: solo se empaquetan sherpa y onnxruntime
  for (const f of libs) { fs.copyFileSync(path.join(release, f), path.join(stage, f)); staged.add(f) }

  for (const f of ['libsherpa-onnx-c-api.dylib', 'libonnxruntime.dylib']) {
    if (!fs.existsSync(path.join(release, f))) fail(`No se encontro ${f} en target/release (voz de la maestra)`)
    fs.copyFileSync(path.join(release, f), path.join(stage, f)); staged.add(f)
  }

  const backendsDir = path.join(release, 'backends')
  const backends = fs.existsSync(backendsDir) ? fs.readdirSync(backendsDir).filter(f => f.endsWith('.dylib')) : []
  for (const f of backends) { fs.copyFileSync(path.join(backendsDir, f), path.join(stage, 'backends', f)); staged.add(f) }

  const int = args => {
    try { execFileSync('install_name_tool', args, { stdio: 'pipe', encoding: 'utf8' }) }
    catch (e) {
      const msg = String(e.stderr || e.message)
      // el rpath ya estaba puesto: no es un error
      if (args[0] === '-add_rpath' && /would duplicate path|already has LC_RPATH/.test(msg)) return
      fail(`install_name_tool ${args.join(' ')}\n${msg}`)
    }
  }
  const depsOf = file => execFileSync('otool', ['-L', file], { encoding: 'utf8' })
    .split('\n').map(l => l.trim().split(' ')[0]).filter(p => p.startsWith('/') || p.startsWith('@'))

  // Cada libreria se referencia por @rpath/<nombre> y busca a las demas en su carpeta.
  const fix = (file, rpath) => {
    const b = path.basename(file)
    int(['-id', `@rpath/${b}`, file])
    int(['-add_rpath', rpath, file])
    for (const dep of depsOf(file)) {
      const d = path.basename(dep)
      if (staged.has(d)) int(['-change', dep, `@rpath/${d}`, file])
    }
  }
  for (const f of fs.readdirSync(stage)) if (f.endsWith('.dylib')) fix(path.join(stage, f), '@loader_path')
  for (const f of fs.readdirSync(path.join(stage, 'backends'))) if (f.endsWith('.dylib')) fix(path.join(stage, 'backends', f), '@loader_path/..')

  // El ejecutable: busca las librerias en Contents/Resources (rpath fijado en build.rs).
  const binary = fs.readdirSync(release).find(f => {
    const full = path.join(release, f)
    if (fs.statSync(full).isDirectory() || /^lib.*\.(dylib|so)$/.test(f)) return false
    try { execFileSync('otool', ['-h', full], { stdio: 'ignore' }); return true } catch { return false }
  })
  if (!binary) fail('No se encontro el ejecutable en target/release')
  const binPath = path.join(release, binary)
  for (const dep of depsOf(binPath)) {
    const d = path.basename(dep)
    if (staged.has(d)) int(['-change', dep, `@rpath/${d}`, binPath])
  }

  // install_name_tool invalida la firma; en Apple Silicon un binario sin firma valida no carga.
  // Firma ad-hoc (sin cuenta de Apple) para cada libreria y el ejecutable.
  const sign = file => {
    try { execFileSync('codesign', ['--force', '--sign', '-', file], { stdio: 'pipe', encoding: 'utf8' }) }
    catch (e) { fail(`codesign ${file}\n${String(e.stderr || e.message)}`) }
  }
  for (const f of fs.readdirSync(stage)) if (f.endsWith('.dylib')) sign(path.join(stage, f))
  for (const f of fs.readdirSync(path.join(stage, 'backends'))) if (f.endsWith('.dylib')) sign(path.join(stage, 'backends', f))
  sign(binPath)

  // Tauri resources: origen (relativo a src-tauri) -> destino dentro de Contents/Resources
  const resources = {}
  const walk = dir => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f)
      if (fs.statSync(full).isDirectory()) walk(full)
      else {
        const rel = path.posix.relative(stage, full)
        resources[path.posix.join('target/release/lib-bundle', rel)] = rel
      }
    }
  }
  walk(stage)
  fs.writeFileSync(out, JSON.stringify({ bundle: { resources } }, null, 2))
  const mb = Object.values(resources).reduce((s, r) => s + fs.statSync(path.join(stage, r)).size, 0) / 1e6
  console.log(`✓ ${Object.keys(resources).length} archivos (${mb.toFixed(0)} MB) para macOS (Metal)`)
  console.log(`✓ ${path.relative(root, out)}`)
  process.exit(0)
}

// ---- Windows (.exe NSIS): el loader busca las DLL junto al ejecutable, no hace falta rpath ----
if (win) {
  const libs = fs.readdirSync(release).filter(f => /^(?:lib)?(llama|ggml|mtmd)[\w-]*\.dll$/i.test(f))
  if (!libs.length) fail('No se encontraron las DLL de llama.cpp en target/release')
  for (const f of libs) fs.copyFileSync(path.join(release, f), path.join(stage, f))

  const voice = fs.readdirSync(release).filter(f => /^(?:lib)?(sherpa[\w-]*|onnxruntime)[\w-]*\.dll$/i.test(f))
  if (!voice.length) fail('No se encontro la DLL de sherpa/onnxruntime en target/release (voz de la maestra)')
  for (const f of voice) fs.copyFileSync(path.join(release, f), path.join(stage, f))

  const backendsDir = path.join(release, 'backends')
  const backends = fs.existsSync(backendsDir) ? fs.readdirSync(backendsDir).filter(f => f.endsWith('.dll')) : []
  if (!backends.some(f => /ggml-cpu/i.test(f))) fail('No se encontraron los backends de CPU')
  for (const f of backends) fs.copyFileSync(path.join(backendsDir, f), path.join(stage, 'backends', f))

  // Tauri resources: origen (relativo a src-tauri) -> destino junto al ejecutable
  const resources = {}
  const walk = dir => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f)
      if (fs.statSync(full).isDirectory()) walk(full)
      else {
        const rel = path.posix.relative(stage, full)
        resources[path.posix.join('target/release/lib-bundle', rel)] = rel
      }
    }
  }
  walk(stage)
  const windows = base.bundle?.windows ?? {}
  fs.writeFileSync(out, JSON.stringify({ bundle: { resources, windows } }, null, 2))

  const mb = Object.values(resources).reduce((s, r) => s + fs.statSync(path.join(stage, r)).size, 0) / 1e6
  console.log(`✓ ${Object.keys(resources).length} archivos (${mb.toFixed(0)} MB) para Windows (solo CPU)`)
  console.log(`✓ ${path.relative(root, out)}`)
  process.exit(0)
}

// ---- Linux (.deb / AppImage) ----
const INSTALL_DIR = '/usr/lib/matematicas-teacher'

// 1) Librerias de llama.cpp (el binario las pide por su soname: libllama.so.0, ...)
const libs = fs.readdirSync(release).filter(f => /^lib(llama|ggml|mtmd)[\w-]*\.so\.\d+$/.test(f))
if (!libs.length) fail('No se encontraron las librerias de llama.cpp en target/release')
for (const f of libs) fs.copyFileSync(path.join(release, f), path.join(stage, f))

// 1b) Voz natural de la maestra (sherpa-onnx + onnxruntime)
for (const f of ['libsherpa-onnx-c-api.so', 'libonnxruntime.so']) {
  if (!fs.existsSync(path.join(release, f))) fail(`No se encontro ${f} en target/release (voz de la maestra)`)
  fs.copyFileSync(path.join(release, f), path.join(stage, f))
}

// 2) Modulos de backend
const backendsDir = path.join(release, 'backends')
const backends = fs.existsSync(backendsDir) ? fs.readdirSync(backendsDir).filter(f => f.endsWith('.so')) : []
if (!backends.some(f => f.startsWith('libggml-cpu'))) fail('No se encontraron los backends de CPU')
const hasCuda = backends.includes('libggml-cuda.so')
if (gpu && !hasCuda) fail('Se pidio la version con GPU pero no hay libggml-cuda.so: compila con la feature "cuda"')
if (!gpu && hasCuda) console.warn('! Hay modulo CUDA pero se empaqueta la version solo CPU: se omite')
for (const f of backends) {
  if (f === 'libggml-cuda.so' && !gpu) continue
  fs.copyFileSync(path.join(backendsDir, f), path.join(stage, 'backends', f))
}

// 3) Version con GPU: librerias de CUDA junto al modulo
if (gpu) {
  const cudaModule = path.join(stage, 'backends', 'libggml-cuda.so')
  const needed = execFileSync('readelf', ['-d', cudaModule], { encoding: 'utf8' })
    .split('\n')
    .map(l => l.match(/NEEDED.*\[(libcu(?:dart|blas)[^\]]*)\]/)?.[1])
    .filter(Boolean)
  const cudaPath = process.env.CUDA_PATH || '/usr/local/cuda'
  const searchDirs = [path.join(cudaPath, 'targets', 'x86_64-linux', 'lib'), path.join(cudaPath, 'lib64')]
  const copied = new Set()
  const copyCuda = name => {
    if (copied.has(name)) return
    const dir = searchDirs.find(d => fs.existsSync(path.join(d, name)))
    if (!dir) fail(`No se encontro ${name} en ${searchDirs.join(', ')} (define CUDA_PATH)`)
    fs.copyFileSync(fs.realpathSync(path.join(dir, name)), path.join(stage, name))
    copied.add(name)
    // libcublas necesita a su vez libcublasLt
    const deps = execFileSync('readelf', ['-d', path.join(stage, name)], { encoding: 'utf8' })
    for (const m of deps.matchAll(/NEEDED.*\[(libcu(?:dart|blas)[^\]]*)\]/g)) copyCuda(m[1])
  }
  needed.forEach(copyCuda)
  console.log(`✓ CUDA: ${[...copied].join(', ')}`)
}

// 4) Rutas de busqueda: cada libreria encuentra a las demas en su carpeta (necesario para la app
//    instalada y para que linuxdeploy pueda armar la AppImage)
for (const f of fs.readdirSync(stage).filter(f => f.includes('.so'))) {
  execFileSync('patchelf', ['--set-rpath', '$ORIGIN', path.join(stage, f)])
}
for (const f of fs.readdirSync(path.join(stage, 'backends'))) {
  execFileSync('patchelf', ['--set-rpath', '$ORIGIN/..', path.join(stage, 'backends', f)])
}

// 5) Configuracion de Tauri con todos los archivos (destino -> origen)
const files = {}
const walk = dir => {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) walk(full)
    else files[path.posix.join(INSTALL_DIR, path.relative(stage, full))] = full
  }
}
walk(stage)
const linux = base.bundle?.linux ?? {}
const config = {
  bundle: { linux: { ...linux, deb: { ...linux.deb, files }, appimage: { ...linux.appimage, files } } },
}
fs.writeFileSync(out, JSON.stringify(config, null, 2))

const mb = Object.values(files).reduce((s, f) => s + fs.statSync(f).size, 0) / 1e6
console.log(`✓ ${Object.keys(files).length} archivos (${mb.toFixed(0)} MB) para la version ${gpu ? 'con GPU NVIDIA' : 'solo CPU'}`)
console.log(`✓ ${path.relative(root, out)}`)
