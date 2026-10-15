#!/usr/bin/env node
// Borra las copias de las librerias de llama.cpp en target/<perfil> antes de compilar.
// llama-cpp-sys-2 las enlaza ahi y, al cambiar entre la version con CUDA y la solo CPU
// (o cuando cambia el hash del build por las features), deja enlaces viejos que despues
// no puede reemplazar ("File exists"). Se vuelven a generar al compilar.
//
// Uso: node scripts/clean-llama-libs.mjs [debug|release]   (default: release)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const profile = process.argv[2] || 'release'
if (!['debug', 'release'].includes(profile)) {
  console.error('Uso: node scripts/clean-llama-libs.mjs [debug|release]')
  process.exit(1)
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'src-tauri', 'target', profile)
let removed = 0
for (const dir of [target, path.join(target, 'deps'), path.join(target, 'examples'), path.join(target, 'backends')]) {
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir)) {
    if (/^(?:lib)?(llama|ggml|mtmd)[\w-]*\.(so|dylib|dll)/i.test(f)) {
      fs.rmSync(path.join(dir, f), { force: true })
      removed++
    }
  }
}
if (removed) console.log(`✓ ${removed} librerias de llama.cpp viejas borradas de target/${profile}`)
