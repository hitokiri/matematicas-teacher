#!/usr/bin/env node
// Copia los instaladores generados a ./instaladores con un nombre que dice la version:
//   matematicas-teacher_0.1.0_amd64_con-GPU-NVIDIA.deb / ..._solo-CPU.AppImage / ..._macOS.dmg
//
// Uso: node scripts/collect-bundles.mjs gpu|cpu|mac

import fs from 'node:fs'
import path from 'node:path'

const variant = process.argv[2]
if (!['gpu', 'cpu', 'mac'].includes(variant)) {
  console.error('Uso: node scripts/collect-bundles.mjs gpu|cpu|mac')
  process.exit(1)
}
const suffix = variant === 'gpu' ? 'con-GPU-NVIDIA' : variant === 'cpu' ? 'solo-CPU' : 'macOS'
const arch = variant === 'mac' ? 'arm64' : 'amd64'
const targets = variant === 'mac' ? [['dmg', '.dmg']] : [['deb', '.deb'], ['appimage', '.AppImage']]
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const bundleDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle')
const outDir = path.join(root, 'instaladores')
const version = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8')).version
fs.mkdirSync(outDir, { recursive: true })

const found = []
for (const [sub, ext] of targets) {
  const dir = path.join(bundleDir, sub)
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(ext))) {
    const name = `matematicas-teacher_${version}_${arch}_${suffix}${ext}`
    fs.copyFileSync(path.join(dir, f), path.join(outDir, name))
    found.push(name)
  }
}
if (!found.length) {
  console.error(`No hay instaladores en ${bundleDir}`)
  process.exit(1)
}
found.forEach(f => console.log(`✓ instaladores/${f}`))
