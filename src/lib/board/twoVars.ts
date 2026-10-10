// Ecuaciones lineales con dos incognitas (2x + 3y = 6): tienen muchas soluciones.
// La app despeja una letra y busca parejas que cumplen la ecuacion, sin saltarse pasos.

import { fromLatex } from './expression'
import type { Q } from './rational'
import { add, div, eq, isInt, isZero, mul, neg, q, show, sub, value } from './rational'
import type { BoardItem, BoardScript, BoardStep } from './types'

export interface TwoVarEquation {
  /** a·x + b·y = c (x, y en orden alfabetico) */
  a: Q
  b: Q
  c: Q
  x: string
  y: string
  text: string
}

/** Lado de la ecuacion: coeficientes por letra y numero suelto */
interface Side {
  coef: Record<string, Q>
  num: Q
}

const ZERO = q(0)
const ONE = q(1)
const TERM = /^([+-])?(\d+(?:\.\d+)?)?(?:\/(\d+))?\*?([a-z])?/

export function parseTwoVarEquation(input: string): TwoVarEquation | null {
  let s = fromLatex(input).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  s = s.replace(/^(resuelve|calcula)\s*:?\s*/, '')
  s = s.replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, '')
  const sides = s.split('=')
  if (sides.length !== 2) return null
  const letters = [...new Set(s.match(/[a-z]/g) ?? [])].sort()
  if (letters.length !== 2) return null

  const parseSide = (t: string): Side | null => {
    const side: Side = { coef: {}, num: ZERO }
    if (!t) return null
    for (let i = 0; i < t.length; ) {
      const m = t.slice(i).match(TERM)
      if (!m || !m[0] || (!m[2] && !m[4])) return null
      // Cada termino despues del primero empieza con signo
      if (i > 0 && !m[1]) return null
      if (m[3] && !m[2]) return null
      if (m[3] && Number(m[3]) === 0) return null
      const [int, dec = ''] = (m[2] ?? '1').split('.')
      let k = q(Number(int + dec), 10 ** dec.length)
      if (m[3]) k = div(k, q(Number(m[3])))
      if (m[1] === '-') k = neg(k)
      if (m[4]) side.coef[m[4]] = add(side.coef[m[4]] ?? ZERO, k)
      else side.num = add(side.num, k)
      i += m[0].length
    }
    return side
  }

  const l = parseSide(sides[0])
  const r = parseSide(sides[1])
  if (!l || !r) return null
  const [x, y] = letters
  const coef = (v: string) => sub(l.coef[v] ?? ZERO, r.coef[v] ?? ZERO)
  const a = coef(x)
  const b = coef(y)
  if (isZero(a) || isZero(b)) return null
  return { a, b, c: sub(r.num, l.num), x, y, text: input.trim() }
}

const txt = (n: Q) => show(n).replace('-', '−')
/** Numero dentro de una cuenta: los negativos van entre parentesis */
const inner = (n: Q) => (value(n) < 0 ? `(${txt(n)})` : txt(n))
/** "2x", "x", "−x", "3/2y" */
const term = (k: Q, v: string) => (eq(k, ONE) ? v : eq(k, neg(ONE)) ? `−${v}` : `${txt(k)}${v}`)

/** "6 − 2x", "−6 + 2x", "−2x" (primero el numero, como se lee al despejar) */
function constMinus(c: Q, k: Q, v: string): string {
  const abs = term(value(k) < 0 ? neg(k) : k, v)
  if (isZero(c)) return value(k) > 0 ? `−${abs}` : abs
  return `${txt(c)} ${value(k) > 0 ? '−' : '+'} ${abs}`
}

/** Valores de x que dan parejas faciles: x = 0 y otro que deje y entera (si se puede) */
function pickXs(a: Q, b: Q, c: Q): Q[] {
  const yOf = (xv: Q) => div(sub(c, mul(a, xv)), b)
  const xs: Q[] = [ZERO]
  const root = div(c, a)
  if (!isZero(root) && isInt(root) && Math.abs(value(root)) <= 50) xs.push(root)
  else {
    const found = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, 8, 9, 10, 11, 12].find(n => isInt(yOf(q(n))))
    xs.push(q(found ?? 1))
  }
  return xs
}

export function twoVarScript(e: TwoVarEquation): BoardScript {
  const { a, b, c, x, y } = e
  let n = 0
  let row = 0
  const steps: BoardStep[] = []
  const write = (text: string, tone: 'op' | 'line-text' | 'result' | 'muted' = 'line-text') => {
    const item: BoardItem = { id: `t${n++}`, kind: 'text', row: row, col: 0, text, tone, align: 'start' }
    return { add: [item], focus: [[row++, 0]] as Array<[number, number]> }
  }
  const lhs = `${term(a, x)} ${value(b) < 0 ? '−' : '+'} ${term(value(b) < 0 ? neg(b) : b, y)}`
  const original = e.text.replace(/\s*=\s*/, ' = ')

  steps.push({
    say: `Esta ecuación tiene dos letras: la ${x} y la ${y}. Con una sola ecuación no hay un único resultado: ` +
      `hay muchas parejas de números que la cumplen. Vamos a despejar la ${y} y después buscar parejas.`,
    ...write(original, 'op'),
  })

  const ordered = `${lhs} = ${txt(c)}`
  const norm = (t: string) => t.replace(/\s/g, '').replace(/−/g, '-')
  if (norm(ordered) !== norm(original)) {
    steps.push({
      say: `Acomodamos la ecuación: las letras de un lado y el número solo del otro.`,
      ...write(ordered),
    })
  }

  // Despejar y: pasar la x al otro lado
  let k = b
  let rc = c
  let rx = a
  const ax = term(value(a) < 0 ? neg(a) : a, x)
  steps.push({
    say: value(a) > 0
      ? `Queremos la ${y} sola. Quitamos ${ax} de los dos lados, así la ecuación sigue en equilibrio.`
      : `Queremos la ${y} sola. Sumamos ${ax} a los dos lados para cancelarlo.`,
    ...write(`${lhs} ${value(a) > 0 ? '−' : '+'} ${ax} = ${txt(c)} ${value(a) > 0 ? '−' : '+'} ${ax}`),
  })
  steps.push({ say: `Nos queda ${term(k, y)} = ${constMinus(rc, rx, x)}.`, ...write(`${term(k, y)} = ${constMinus(rc, rx, x)}`) })

  if (value(k) < 0) {
    k = neg(k)
    rc = neg(rc)
    rx = neg(rx)
    steps.push({
      say: `La ${y} tiene signo menos. Cambiamos el signo de todo (multiplicamos los dos lados por −1).`,
      ...write(`${term(k, y)} = ${constMinus(rc, rx, x)}`),
    })
  }

  const isOne = eq(k, ONE)
  const formula = isOne ? `${y} = ${constMinus(rc, rx, x)}` : `${y} = (${constMinus(rc, rx, x)}) ÷ ${txt(k)}`
  if (!isOne) {
    steps.push({
      say: `Hay ${txt(k)} ${y}. Dividimos los dos lados entre ${txt(k)} para dejar una sola ${y}.`,
      ...write(formula, 'result'),
    })
  } else {
    steps.push({ say: `¡La ${y} ya está sola! Esta regla nos da la ${y} para cualquier ${x}.`, ...write(formula, 'result') })
  }

  // Buscar parejas: cambiar la x por un numero y hacer las cuentas una por una
  const pairs: Array<[Q, Q]> = []
  const wrap = (s: string) => (isOne ? s : `(${s}) ÷ ${txt(k)}`)
  for (const xv of pickXs(a, b, c)) {
    const prod = mul(rx, xv)
    const rest = sub(rc, prod)
    const yv = div(rest, k)
    const op = value(rx) > 0 ? '−' : '+'
    const absRx = value(rx) < 0 ? neg(rx) : rx
    const absProd = value(rx) < 0 ? neg(prod) : prod
    steps.push({
      say: `Probamos con ${x} = ${txt(xv)}: cambiamos la ${x} por ${txt(xv)} en la regla.`,
      ...write(`Si ${x} = ${txt(xv)}:  ${y} = ${wrap(`${txt(rc)} ${op} ${txt(absRx)} × ${inner(xv)}`)}`),
    })
    steps.push({
      say: `Primero la multiplicación: ${txt(absRx)} × ${inner(xv)} = ${txt(absProd)}.`,
      ...write(`${y} = ${wrap(`${txt(rc)} ${op} ${inner(absProd)}`)}`),
    })
    steps.push({
      say: `Ahora ${txt(rc)} ${op} ${inner(absProd)} = ${txt(rest)}.`,
      ...write(isOne ? `${y} = ${txt(rest)}` : `${y} = ${txt(rest)} ÷ ${txt(k)}`, isOne ? 'result' : 'line-text'),
    })
    if (!isOne) {
      steps.push({ say: `Y ${txt(rest)} ÷ ${txt(k)} = ${txt(yv)}.`, ...write(`${y} = ${txt(yv)}`, 'result') })
    }
    steps.push({
      say: `Comprobamos en la ecuación del principio: ${txt(a)} × ${inner(xv)} + ${inner(b)} × ${inner(yv)} = ${txt(c)}. ` +
        `¡Se cumple! Una pareja es ${x} = ${txt(xv)}, ${y} = ${txt(yv)}. ✔`,
      ...write(`${txt(a)} × ${inner(xv)} + ${inner(b)} × ${inner(yv)} = ${txt(c)}  ✔`, 'muted'),
    })
    pairs.push([xv, yv])
  }

  const ex = pairs.map(([xv, yv]) => `${x} = ${txt(xv)}, ${y} = ${txt(yv)}`).join(' o ')
  const answer = `${formula} (por ejemplo ${ex})`
  steps.push({
    say: `¡Listo! La regla es ${formula}. Con cualquier ${x} sale su ${y}; por ejemplo ${ex}. 🎉`,
    ...write(`✔ ${answer}`, 'result'),
  })

  const longest = Math.max(...steps.flatMap(s => s.add).map(i => (i.kind === 'text' ? i.text.length : 0)), 10)
  return { title: e.text, cols: Math.ceil(longest / 1.6) + 1, rows: row, steps, answer }
}
