// Expresiones numericas (orden de operaciones, parentesis, potencias y raices) resueltas por la
// app paso a paso. Las raices no exactas se encuentran por tanteo, como se ensena en la escuela.

import type { BoardItem, BoardScript, BoardStep, Tone } from './types'

type Node =
  | { k: 'num'; v: number; approx?: boolean }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; l: Node; r: Node }
  | { k: 'pow'; base: Node; exp: number }
  | { k: 'root'; n: number; arg: Node }
  | { k: 'paren'; inner: Node }

type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: 'lp' } | { t: 'rp' }
  | { t: 'root'; n: number }
  | { t: 'sup'; n: number }

const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' } as const
const ROOT_SYM: Record<number, string> = { 2: '√', 3: '∛', 4: '∜' }
const ROOT_NAME: Record<number, string> = { 2: 'raíz cuadrada', 3: 'raíz cúbica', 4: 'raíz cuarta' }
const SUP: Record<number, string> = { 2: '²', 3: '³' }

/** Numero para mostrar: hasta 3 decimales, con punto */
export function fmt(v: number): string {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/** Normaliza el texto: palabras -> simbolos. "raiz cubica de 3x4+7" -> "∛(3x4+7)" */
function normalize(input: string): string | null {
  let s = input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  s = s.replace(/^(cuanto es|cuanto da|resuelve|calcula)\s*/, '')
  s = s.replace(/\s*(=\s*)?\??\s*$/, '')
  // "raiz ... de" aplica a todo lo que sigue
  let opened = 0
  s = s.replace(/raiz\s+(cuadrada|cubica|cuarta)?\s*de\s*/g, (_, kind) => {
    opened++
    return (kind === 'cubica' ? '∛' : kind === 'cuarta' ? '∜' : '√') + '('
  })
  s += ')'.repeat(opened)
  s = s
    .replace(/\s+al\s+cuadrado/g, '²')
    .replace(/\s+al\s+cubo/g, '³')
    .replace(/\s+(por)\s+/g, '*')
    .replace(/\s+(mas)\s+/g, '+')
    .replace(/\s+(menos)\s+/g, '-')
    .replace(/\s+(entre|dividido entre|dividido por)\s+/g, '/')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[−–—]/g, '-')
    .replace(/[÷:]/g, '/')
    .replace(/[×·]/g, '*')
    .replace(/\s+/g, '')
  return s
}

function tokenize(s: string): Token[] | null {
  const out: Token[] = []
  let i = 0
  const prevIsValue = () => {
    const p = out[out.length - 1]
    return !!p && (p.t === 'num' || p.t === 'rp' || p.t === 'sup')
  }
  while (i < s.length) {
    const c = s[i]
    const num = s.slice(i).match(/^\d+(\.\d+)?/)
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) })
      i += num[0].length
      continue
    }
    if ('+-*/^'.includes(c)) out.push({ t: 'op', v: c as '+' })
    // "x" solo es multiplicacion entre valores (en "2x + 3" es una incognita: eso lo explica el modelo)
    else if (c === 'x') {
      if (!prevIsValue() || !/[\d(√∛∜]/.test(s[i + 1] ?? '')) return null
      out.push({ t: 'op', v: '*' })
    } else if (c === '(') out.push({ t: 'lp' })
    else if (c === ')') out.push({ t: 'rp' })
    else if (c === '√') out.push({ t: 'root', n: 2 })
    else if (c === '∛') out.push({ t: 'root', n: 3 })
    else if (c === '∜') out.push({ t: 'root', n: 4 })
    else if (c === '²') out.push({ t: 'sup', n: 2 })
    else if (c === '³') out.push({ t: 'sup', n: 3 })
    else return null
    i++
  }
  return out
}

/** Analizador por precedencia: suma/resta < multiplicacion/division < potencia < raiz/parentesis */
function parse(tokens: Token[]): Node | null {
  let pos = 0
  const peek = () => tokens[pos]
  const fail = () => { throw new Error('parse') }

  const expr = (): Node => {
    let node = term()
    for (let t = peek(); t?.t === 'op' && (t.v === '+' || t.v === '-'); t = peek()) {
      pos++
      node = { k: 'bin', op: t.v, l: node, r: term() }
    }
    return node
  }
  const term = (): Node => {
    let node = power()
    for (;;) {
      const t = peek()
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        pos++
        node = { k: 'bin', op: t.v, l: node, r: power() }
      } else if (t && (t.t === 'lp' || t.t === 'root')) {
        // multiplicacion implicita: 3(4+1), 2√9
        node = { k: 'bin', op: '*', l: node, r: power() }
      } else return node
    }
  }
  const power = (): Node => {
    let node = primary()
    for (;;) {
      const t = peek()
      if (t?.t === 'sup') {
        pos++
        node = { k: 'pow', base: node, exp: t.n }
      } else if (t?.t === 'op' && t.v === '^') {
        pos++
        const e = peek()
        if (e?.t !== 'num' || !Number.isInteger(e.v) || e.v < 0 || e.v > 10) fail()
        pos++
        node = { k: 'pow', base: node, exp: (e as { v: number }).v }
      } else return node
    }
  }
  const primary = (): Node => {
    const t = peek()
    if (!t) fail()
    pos++
    if (t.t === 'num') return { k: 'num', v: t.v }
    if (t.t === 'op' && t.v === '-') {
      const inner = primary()
      if (inner.k !== 'num') fail()
      return { k: 'num', v: -(inner as { v: number }).v }
    }
    if (t.t === 'lp') {
      const inner = expr()
      if (peek()?.t !== 'rp') fail()
      pos++
      // "(27)" es solo un numero: no hace falta un paso para quitar el parentesis
      return inner.k === 'num' ? inner : { k: 'paren', inner }
    }
    if (t.t === 'root') return { k: 'root', n: t.n, arg: primary() }
    return fail()
  }

  try {
    const node = expr()
    return pos === tokens.length ? node : null
  } catch {
    return null
  }
}

/** Texto de la expresion en partes; `mark` se resalta (el valor recien calculado) */
function print(node: Node, mark?: Node): Array<{ text: string; tone?: Tone }> {
  const hl = (parts: Array<{ text: string; tone?: Tone }>) =>
    node === mark ? [{ text: parts.map(p => p.text).join(''), tone: 'result' as Tone }] : parts
  switch (node.k) {
    case 'num': return hl([{ text: node.v < 0 && node !== mark ? `(${fmt(node.v)})` : fmt(node.v) }])
    case 'paren': return hl([{ text: '(' }, ...print(node.inner, mark), { text: ')' }])
    case 'bin': return hl([...print(node.l, mark), { text: ` ${SYM[node.op]} ` }, ...print(node.r, mark)])
    case 'pow': return hl([...print(node.base, mark), { text: SUP[node.exp] ?? `^${node.exp}` }])
    case 'root': {
      const arg = print(node.arg, mark)
      const wrap = node.arg.k === 'num' || node.arg.k === 'paren'
      return hl([{ text: ROOT_SYM[node.n] ?? `${node.n}√` }, ...(wrap ? arg : [{ text: '(' }, ...arg, { text: ')' }])])
    }
  }
}

function hasOperation(node: Node): boolean {
  return node.k !== 'num'
}

function hasApprox(node: Node): boolean {
  switch (node.k) {
    case 'num': return !!node.approx
    case 'paren': return hasApprox(node.inner)
    case 'bin': return hasApprox(node.l) || hasApprox(node.r)
    case 'pow': return hasApprox(node.base)
    case 'root': return hasApprox(node.arg)
  }
}

/** Reconoce una expresion numerica con al menos una operacion (sin incognitas) */
export function parseExpression(input: string): Node | null {
  const s = normalize(input)
  if (!s) return null
  const tokens = tokenize(s)
  if (!tokens?.length) return null
  const node = parse(tokens)
  return node && hasOperation(node) ? node : null
}

interface Reduction {
  node: Node
  /** Lo que dice la maestra */
  say: string
  /** Pasos intermedios de la raiz: cada uno con renglones y narracion */
  substeps: Array<{ lines: string[]; say: string }>
  error?: string
}

const power = (b: number, n: number) => b ** n
const product = (b: string, n: number) => Array(n).fill(b).join(' × ')

/** Busca la raiz n-esima por tanteo: enteros, decimas y centesimas */
function rootByTrial(x: number, n: number): { value: number; exact: boolean; substeps: Array<{ lines: string[]; say: string }> } {
  const sym = ROOT_SYM[n] ?? `${n}√`
  const name = ROOT_NAME[n] ?? `raíz ${n}`
  const substeps: Array<{ lines: string[]; say: string }> = []
  const negative = x < 0 && n % 2 === 1
  const a = Math.abs(x)
  const sign = negative ? -1 : 1

  // Enteros: 1, 2, 3... hasta llegar o pasarse
  let k = 0
  const intLines: string[] = []
  while (power(k + 1, n) <= a && k < 1000) {
    k++
    intLines.push(`${product(String(k), n)} = ${fmt(power(k, n))}`)
  }
  if (power(k, n) === a) {
    substeps.push({
      lines: intLines.slice(-3),
      say: `Buscamos un número que multiplicado por sí mismo ${n === 2 ? '2 veces' : `${n} veces`} dé ${fmt(a)}. ¡${product(String(k), n)} = ${fmt(a)} justo!`,
    })
    return { value: sign * k, exact: true, substeps }
  }
  intLines.push(`${product(String(k + 1), n)} = ${fmt(power(k + 1, n))}`)
  substeps.push({
    lines: intLines.slice(-3),
    say: `Buscamos un número que multiplicado por sí mismo ${n === 2 ? '2 veces' : `${n} veces`} dé ${fmt(a)}. ` +
      `Probamos con enteros: ${fmt(a)} está entre ${fmt(power(k, n))} y ${fmt(power(k + 1, n))}, así que la ${name} está entre ${k} y ${k + 1}.`,
  })

  // Decimas y centesimas
  let low = k
  for (const [stepSize, label] of [[0.1, 'décimas'], [0.01, 'centésimas']] as const) {
    let d = low
    while (power(round(d + stepSize), n) <= a) d = round(d + stepSize)
    const hi = round(d + stepSize)
    const pd = power(d, n)
    const ph = power(hi, n)
    if (pd === a) {
      substeps.push({ lines: [`${product(fmt(d), n)} = ${fmt(pd)}`], say: `Probamos con ${label}: ¡${product(fmt(d), n)} = ${fmt(a)} justo!` })
      return { value: sign * d, exact: true, substeps }
    }
    substeps.push({
      lines: [
        `${product(fmt(d), n)} = ${fmt(pd)}  (le falta)`,
        `${product(fmt(hi), n)} = ${fmt(ph)}  (se pasa)`,
      ],
      say: `Ahora probamos con ${label}: ${fmt(d)} da ${fmt(pd)}, que es un poco menos que ${fmt(a)}, y ${fmt(hi)} da ${fmt(ph)}, que se pasa. ` +
        `Entonces ${sym}${fmt(a)} está entre ${fmt(d)} y ${fmt(hi)}.`,
    })
    low = d
    if (label === 'centésimas') {
      const best = a - pd <= ph - a ? d : hi
      substeps.push({
        lines: [],
        say: `El que queda más cerca de ${fmt(a)} es ${fmt(best)}. Así que ${sym}${fmt(a)} es aproximadamente ${fmt(best)}.`,
      })
      return { value: sign * best, exact: false, substeps }
    }
  }
  return { value: sign * low, exact: false, substeps }
}

function round(v: number) {
  return Math.round(v * 1e6) / 1e6
}

/** Reduce la primera operacion lista (de adentro hacia afuera, de izquierda a derecha) */
function reduceOnce(node: Node, ctx: { first: Record<string, boolean> }): { node: Node; red: Reduction } | null {
  const done = (value: number, approx: boolean, say: string, extra: Partial<Reduction> = {}) => {
    const n: Node = { k: 'num', v: value, approx }
    return { node: n, red: { node: n, say, substeps: [], ...extra } }
  }
  switch (node.k) {
    case 'num': return null
    case 'paren': {
      const r = reduceOnce(node.inner, ctx)
      if (!r) return null
      // Un parentesis con un solo numero ya no hace falta
      return { node: r.node.k === 'num' ? r.node : { k: 'paren', inner: r.node }, red: r.red }
    }
    case 'bin': {
      const l = reduceOnce(node.l, ctx)
      if (l) return { node: { ...node, l: l.node }, red: l.red }
      const r = reduceOnce(node.r, ctx)
      if (r) return { node: { ...node, r: r.node }, red: r.red }
      if (node.l.k !== 'num' || node.r.k !== 'num') return null
      const a = node.l.v, b = node.r.v
      const approx = !!node.l.approx || !!node.r.approx
      const group = node.op === '*' || node.op === '/' ? 'muldiv' : 'addsub'
      const intro = !ctx.first[group]
        ? group === 'muldiv' ? 'Primero las multiplicaciones y divisiones: ' : 'Ahora las sumas y restas: '
        : 'Seguimos: '
      ctx.first[group] = true
      if (node.op === '/' && b === 0) {
        return { node, red: { node, say: 'No se puede dividir entre 0.', substeps: [], error: 'No se puede dividir entre 0' } }
      }
      const v = node.op === '+' ? a + b : node.op === '-' ? a - b : node.op === '*' ? a * b : a / b
      const inexact = node.op === '/' && Math.round(v * 1000) / 1000 !== v
      const eq = approx || inexact ? '≈' : '='
      return done(v, approx || inexact, `${intro}${fmt(a)} ${SYM[node.op]} ${fmt(b)} ${eq} ${fmt(v)}.`)
    }
    case 'pow': {
      const r = reduceOnce(node.base, ctx)
      if (r) return { node: { ...node, base: r.node }, red: r.red }
      if (node.base.k !== 'num') return null
      const b = node.base.v
      const v = b ** node.exp
      const what = node.exp === 2 ? 'al cuadrado' : node.exp === 3 ? 'al cubo' : `a la ${node.exp}`
      return done(v, !!node.base.approx,
        `${fmt(b)} ${what} significa multiplicarlo por sí mismo: ${product(fmt(b), node.exp)} = ${fmt(v)}.`)
    }
    case 'root': {
      const r = reduceOnce(node.arg, ctx)
      if (r) return { node: { ...node, arg: r.node }, red: r.red }
      if (node.arg.k !== 'num') return null
      const x = node.arg.v
      if (x < 0 && node.n % 2 === 0) {
        return { node, red: { node, say: `No hay ningún número que multiplicado por sí mismo dé un número negativo, así que ${ROOT_SYM[node.n]}${fmt(x)} no tiene solución con los números que conocemos.`, substeps: [], error: 'No tiene solución' } }
      }
      const res = rootByTrial(x, node.n)
      const approx = !res.exact || !!node.arg.approx
      return done(res.value, approx,
        `Entonces ${ROOT_SYM[node.n]}${fmt(x)} ${approx ? '≈' : '='} ${fmt(res.value)}.`,
        { substeps: res.substeps })
    }
  }
}

/** Guion de pizarra para una expresion: un renglon por operacion, con el tanteo de las raices */
export function expressionScript(root: Node, original?: string): BoardScript {
  let n = 0
  const item = (row: number, col: number, text: string, tone: Tone, parts?: Array<{ text: string; tone?: Tone }>): BoardItem =>
    ({ id: `e${n++}`, kind: 'text', row, col, text, tone, align: 'start', parts })
  const title = print(root).map(p => p.text).join('')
  const steps: BoardStep[] = [{
    say: 'Para resolverlo seguimos un orden: primero lo que está dentro de paréntesis y raíces, después potencias, ' +
      'luego multiplicaciones y divisiones, y al final sumas y restas.',
    add: [item(0, 0, title, 'op')],
  }]
  let row = 1
  let node = root
  const ctx = { first: {} as Record<string, boolean> }
  let error: string | undefined
  for (let guard = 0; guard < 40; guard++) {
    const r = reduceOnce(node, ctx)
    if (!r) break
    if (r.red.error) {
      error = r.red.error
      steps.push({ say: r.red.say, add: [] })
      break
    }
    for (const sub of r.red.substeps) {
      const add = sub.lines.map(l => item(row++, 1, l, 'muted'))
      steps.push({ say: sub.say, add, focus: add.map(a => [(a as { row: number }).row, 0] as [number, number]) })
    }
    node = r.node
    const parts = print(node, r.red.node)
    const eq = hasApprox(node) ? '≈ ' : '= '
    const text = eq + parts.map(p => p.text).join('')
    steps.push({ say: r.red.say, add: [item(row, 0, text, 'line-text', [{ text: eq }, ...parts])], focus: [[row, 0]] })
    row++
  }

  const answer = error ?? (node.k === 'num' ? `${node.approx ? '≈ ' : ''}${fmt(node.v)}` : title)
  steps.push({ say: error ? `${error}.` : `¡Listo! ${title} ${answer.startsWith('≈') ? answer : `= ${answer}`}. 🎉`, add: [] })
  const longest = Math.max(...steps.flatMap(s => s.add).map(i => (i.kind === 'text' ? i.text.length + i.col * 2 : 0)), 10)
  return {
    title: original ?? title,
    cols: Math.ceil(longest / 1.6) + 1,
    rows: row,
    steps,
    answer,
  }
}
