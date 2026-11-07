#!/usr/bin/env node
// Genera latest.json para el updater de Tauri a partir de los instaladores y sus .sig en ./instaladores.
// El updater espera: version, platforms[OS-ARCH] con signature + url.
// Uso: node scripts/build-latest-json.mjs [tag]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'hitokiri/matematicas-teacher'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'instaladores')
const tag = process.argv[2] || process.env.GITHUB_REF_NAME || ''

// La variante solo CPU usa su propia clave (la app la fija con Builder::target en main.rs)
const suffixToPlatform = {
  'con-GPU-NVIDIA': 'linux-x86_64',
  'solo-CPU': 'linux-x86_64-cpu',
  'macOS': 'darwin-aarch64',
  'Windows': 'windows-x86_64',
}

const files = fs.readdirSync(outDir).filter(f => f.endsWith('.sig'))
const platforms = {}
for (const sigFile of files) {
  const installer = sigFile.replace(/\.sig$/, '')
  const suffix = Object.keys(suffixToPlatform).find(s => installer.includes(s))
  if (!suffix) continue
  const platform = suffixToPlatform[suffix]
  const signature = fs.readFileSync(path.join(outDir, sigFile), 'utf8').trim()
  platforms[platform] = {
    signature,
    url: `https://github.com/${REPO}/releases/download/${tag}/${installer}`,
  }
}

if (!/^v\d/.test(tag)) {
  console.error(`Etiqueta invalida "${tag}": se espera algo como v0.6.1`)
  process.exit(1)
}
const expected = Object.values(suffixToPlatform)
const missing = expected.filter(p => !platforms[p])
if (missing.length) console.warn(`! Sin firma para: ${missing.join(', ')} (esas instalaciones no se actualizaran)`)
if (!Object.keys(platforms).length) {
  console.error('No hay ningun .sig en instaladores/: falta TAURI_SIGNING_PRIVATE_KEY en el build?')
  process.exit(1)
}

const manifest = {
  version: tag.replace(/^v/, ''),
  notes: '',
  pub_date: new Date().toISOString(),
  platforms,
}

fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(manifest, null, 2))
console.log(`✓ instaladores/latest.json (${Object.keys(platforms).length} plataformas)`)
