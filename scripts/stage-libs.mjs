#!/usr/bin/env node
// Reune las librerias que necesita la app instalada y genera la configuracion de Tauri que las
// incluye en el .deb y la AppImage, en /usr/lib/matematicas-teacher/:
//   - llama.cpp: libllama, libggml*, libmtmd (compartidas, porque los backends son dinamicos)
//   - backends/: modulos de CPU (todas las variantes) y, en la version con GPU, el de CUDA
//   - version con GPU: las librerias de CUDA que usa el modulo (libcudart, libcublas, libcublasLt),
//     para que funcione sin instalar el CUDA Toolkit. Solo hace falta el driver de NVIDIA.
//
// Uso: node scripts/stage-libs.mjs [--gpu]   (despues de `tauri build --no-bundle`)

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const gpu = process.argv.includes('--gpu')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const release = path.join(root, 'src-tauri', 'target', 'release')
const stage = path.join(release, 'lib-bundle')
const INSTALL_DIR = '/usr/lib/matematicas-teacher'

const fail = msg => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

if (!fs.existsSync(release)) fail(`No existe ${release}: primero ejecuta "tauri build --no-bundle"`)
fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(path.join(stage, 'backends'), { recursive: true })

// 1) Librerias de llama.cpp (el binario las pide por su soname: libllama.so.0, ...)
const libs = fs.readdirSync(release).filter(f => /^lib(llama|ggml|mtmd)[\w-]*\.so\.\d+$/.test(f))
if (!libs.length) fail('No se encontraron las librerias de llama.cpp en target/release')
for (const f of libs) fs.copyFileSync(path.join(release, f), path.join(stage, f))

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
const base = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'))
const linux = base.bundle?.linux ?? {}
const config = {
  bundle: { linux: { ...linux, deb: { ...linux.deb, files }, appimage: { ...linux.appimage, files } } },
}
const out = path.join(release, 'bundle-files.json')
fs.writeFileSync(out, JSON.stringify(config, null, 2))

const mb = Object.values(files).reduce((s, f) => s + fs.statSync(f).size, 0) / 1e6
console.log(`✓ ${Object.keys(files).length} archivos (${mb.toFixed(0)} MB) para la version ${gpu ? 'con GPU NVIDIA' : 'solo CPU'}`)
console.log(`✓ ${path.relative(root, out)}`)
