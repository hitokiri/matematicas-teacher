#!/usr/bin/env node
// Borra las copias de las librerias de llama.cpp en target/release antes de compilar.
// llama-cpp-sys-2 las enlaza ahi y, al cambiar entre la version con CUDA y la solo CPU, deja
// enlaces viejos que despues no puede reemplazar ("File exists"). Se vuelven a generar al compilar.

import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const release = path.join(root, 'src-tauri', 'target', 'release')
let removed = 0
for (const dir of [release, path.join(release, 'deps'), path.join(release, 'examples'), path.join(release, 'backends')]) {
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir)) {
    if (/^lib(llama|ggml|mtmd)[\w-]*\.so/.test(f)) {
      fs.rmSync(path.join(dir, f), { force: true })
      removed++
    }
  }
}
if (removed) console.log(`✓ ${removed} librerias de llama.cpp viejas borradas de target/release`)
