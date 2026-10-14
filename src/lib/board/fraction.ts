// Fracciones (1/2 + 1/4, 3/4 − 1/3, 2/3 × 3/5, 1/2 ÷ 1/4, 6/8) resueltas por la app con pizzas:
// el numero de abajo dice en cuantas rebanadas se corta y el de arriba cuantas se toman.

import { fromLatex } from './expression'
import type { Q } from './rational'
import { div, gcd, lcm, q } from './rational'
import type { BoardItem, BoardScript, BoardStep, Pizza, PizzaTerm, Visual } from './types'
import { pick, type Lang } from './lang'

/** Fraccion tal como se escribio (sin simplificar): 2/4 no es lo mismo que 1/2 en la pizarra */
interface Frac {
  n: number
  d: number
}

type Op = '+' | '-' | '*' | '/'

/** Una o varias fracciones (y enteros) con operaciones: 1/2 + 1/4 + 10 */
export interface FractionProblem {
  terms: Frac[]
  ops: Op[]
  text: string
}

const MAX_TERMS = 5

const MAX_SLICES = 24
const MAX_PIZZAS = 4

export function parseFractions(input: string): FractionProblem | null {
  let s = fromLatex(input).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  s = s.replace(/^(cuanto es|cuanto da|resuelve|calcula|simplifica)\s*/, '')
  s = s.replace(/\s*(=\s*)?\??\s*$/, '')
  s = s
    .replace(/\s+(por)\s+/g, '*').replace(/\s+(mas)\s+/g, '+').replace(/\s+(menos)\s+/g, '-')
    .replace(/\s+(entre|dividido entre)\s+/g, '÷')
    .replace(/[−–—]/g, '-').replace(/[×·x]/g, '*').replace(/:/g, '÷')
    .replace(/\s+/g, '')
  // "(1)/(2)" de \frac -> "1/2"
  for (let i = 0; i < 3; i++) s = s.replace(/\((\d+)\)/g, '$1').replace(/\((\d+\/\d+)\)/g, '$1')

  const toFrac = (t: string): Frac | null => {
    const [n, d = '1'] = t.split('/')
    const f = { n: Number(n), d: Number(d) }
    return f.d === 0 || f.d > 100 || f.n > 1000 ? null : f
  }
  // terminos (enteros o a/b) separados por + − × ÷; "/" solo dentro de una fraccion
  if (!/^\d+(\/\d+)?([-+*÷]\d+(\/\d+)?)*$/.test(s)) return null
  const termTexts = s.split(/[-+*÷]/)
  const opTexts = s.match(/[-+*÷]/g) ?? []
  if (termTexts.length > MAX_TERMS || !s.includes('/')) return null
  const terms = termTexts.map(toFrac)
  if (terms.some(t => !t)) return null
  const ops = opTexts.map(o => (o === '÷' ? '/' : o) as Op)

  if (!ops.length) {
    const a = terms[0]!
    // Una fraccion sola: solo si hay algo que hacer (simplificar o pasar a entero y fraccion)
    if (a.d === 1 || (gcd(a.n, a.d) === 1 && a.n < a.d)) return null
    return { terms: [a], ops, text: input.trim() }
  }
  return { terms: terms as Frac[], ops, text: input.trim() }
}

const show = (f: Frac) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`)
const toQ = (f: Frac): Q => q(f.n, f.d)
const fromQ = (v: Q): Frac => ({ n: v.n, d: v.d })

/** Pizzas para dibujar una fraccion; null si no se puede dibujar bien (muchas rebanadas o pizzas) */
function pizzasOf(f: Frac, opts: { second?: number; removed?: number } = {}): Pizza[] | null {
  if (f.n < 0 || f.d > MAX_SLICES) return null
  const wholes = Math.floor(f.n / f.d)
  const rest = f.n % f.d
  const count = wholes + (rest ? 1 : 0) || 1
  if (count > MAX_PIZZAS) return null
  const pizzas: Pizza[] = []
  // La segunda fraccion (suma) y lo que se quita (resta) se reparten desde la ultima rebanada
  let second = opts.second ?? 0
  let removed = opts.removed ?? 0
  for (let i = 0; i < count; i++) {
    const filled = i < wholes ? f.d : rest
    pizzas.push({ slices: f.d, filled, second: 0, removed: 0 })
  }
  for (let i = pizzas.length - 1; i >= 0 && (second || removed); i--) {
    const p = pizzas[i]
    const s2 = Math.min(second, p.filled)
    p.second = s2
    second -= s2
    const r = Math.min(removed, p.filled)
    p.removed = r
    removed -= r
  }
  if (!f.n) pizzas[0].filled = 0
  return pizzas
}

interface TermSpec {
  f: Frac
  /** Texto debajo de la pizza (por defecto la fraccion) */
  label?: string
  second?: number
  removed?: number
}

/** Dibujo de pizzas; undefined si alguna no se puede dibujar bien */
function pizzas(terms: TermSpec[], ops: string[]): Visual | undefined {
  const out: PizzaTerm[] = []
  for (const t of terms) {
    const p = pizzasOf(t.f, { second: t.second, removed: t.removed })
    if (!p) return undefined
    out.push({ label: t.label ?? show(t.f), pizzas: p })
  }
  return { kind: 'pizzas', terms: out, ops }
}

const multiples = (n: number, upTo: number) => {
  const out: number[] = []
  for (let k = n; k <= upTo; k += n) out.push(k)
  return out
}

const sliceName = (d: number, lang: Lang = 'es') => {
  const names: Record<number, string> = lang === 'en'
    ? { 1: 'wholes', 2: 'halves', 3: 'thirds', 4: 'fourths', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths', 9: 'ninths', 10: 'tenths', 12: 'twelfths' }
    : { 1: 'enteras', 2: 'medios', 3: 'tercios', 4: 'cuartos', 5: 'quintos', 6: 'sextos', 7: 'séptimos', 8: 'octavos', 9: 'novenos', 10: 'décimos', 12: 'doceavos' }
  return names[d] ?? (lang === 'en' ? `${d}ths` : `${d}avos`)
}

export function fractionScript(p: FractionProblem, lang: Lang = 'es'): BoardScript {
  const T = pick(lang)
  const sliceOf = (d: number) => sliceName(d, lang)
  const pizzaWord = (count: number) => (count === 1 ? T('pizza entera', 'whole pizza') : T('pizzas enteras', 'whole pizzas'))
  let n = 0
  let row = 0
  const steps: BoardStep[] = []
  const line = (text: string, tone: 'op' | 'line-text' | 'result' | 'muted' = 'line-text'): BoardItem =>
    ({ id: `f${n++}`, kind: 'text', row: row++, col: 0, text, tone, align: 'start' })
  const write = (text: string, tone?: 'op' | 'line-text' | 'result' | 'muted') => {
    const item = line(text, tone)
    return { add: [item], focus: [[(item as { row: number }).row, 0]] as Array<[number, number]> }
  }
  const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }

  const exprText = (terms: Frac[], ops: Op[]) =>
    terms.map((t, i) => (i ? `${sym[ops[i - 1]]} ${show(t)}` : show(t))).join(' ')
  const title = exprText(p.terms, p.ops)
  const mixedOps = p.ops.some(o => o === '*' || o === '/') && p.ops.some(o => o === '+' || o === '-')
  steps.push({
    say: T(
      'Cada fracción es una pizza: el número de abajo dice en cuántas rebanadas iguales la cortamos ' +
        'y el de arriba cuántas rebanadas tomamos.' +
        (p.terms.length > 2 ? ' Como hay varias operaciones, las hacemos una por una' +
          (mixedOps ? ': primero multiplicaciones y divisiones, después sumas y restas.' : ', de izquierda a derecha.') : ''),
      'Each fraction is a pizza: the bottom number says how many equal slices we cut it into, ' +
        'and the top number says how many slices we take.' +
        (p.terms.length > 2 ? ' Since there are several operations, we do them one by one' +
          (mixedOps ? ': first multiplications and divisions, then additions and subtractions.' : ', from left to right.') : ''),
    ),
    add: [line(title, 'op')],
    visual: p.terms.length <= 3 ? pizzas(p.terms.map(f => ({ f })), p.ops.map(o => sym[o])) : undefined,
  })

  const terms = [...p.terms]
  const ops = [...p.ops]
  while (ops.length) {
    // Primero multiplicaciones y divisiones, despues sumas y restas, de izquierda a derecha
    let i = ops.findIndex(o => o === '*' || o === '/')
    if (i < 0) i = 0
    const [x, op, y] = [terms[i], ops[i], terms[i + 1]]
    if (terms.length > 2) {
      steps.push({
        say: T(
          `Ahora hacemos ${x.d === 1 && y.d === 1 ? 'esta cuenta' : 'esta operación'}: ${show(x)} ${sym[op]} ${show(y)}.`,
          `Now we do this ${x.d === 1 && y.d === 1 ? 'calculation' : 'operation'}: ${show(x)} ${sym[op]} ${show(y)}.`,
        ),
        ...write(`${show(x)} ${sym[op]} ${show(y)}`, 'muted'),
      })
    }
    let r = op === '+' || op === '-' ? addSub(x, y, op) : op === '*' ? multiply(x, y) : divide(x, y)
    terms.splice(i, 2, r)
    ops.splice(i, 1)
    if (ops.length) {
      // Simplificar a la mitad del camino hace las siguientes cuentas mas faciles
      const g = gcd(r.n, r.d)
      if (g > 1 && r.n !== 0) {
        const simple = { n: r.n / g, d: r.d / g }
        steps.push({
          say: T(
            `Antes de seguir, ${show(r)} se puede simplificar: dividimos arriba y abajo entre ${g} y queda ${show(simple)}.`,
            `Before moving on, ${show(r)} can be simplified: we divide the top and bottom by ${g} and get ${show(simple)}.`,
          ),
          ...write(`${show(r)} = ${show(simple)}`),
          visual: pizzas([{ f: r }, { f: simple }], ['=']),
        })
        r = simple
        terms[i] = r
      }
      steps.push({
        say: T(`Nos queda ${exprText(terms, ops)}.`, `We are left with ${exprText(terms, ops)}.`),
        ...write(`= ${exprText(terms, ops)}`),
        visual: terms.length <= 3 ? pizzas(terms.map(f => ({ f })), ops.map(o => sym[o])) : undefined,
      })
    }
  }
  let result: Frac = terms[0]

  // Simplificar
  const g = gcd(result.n, result.d)
  if (g > 1 && result.n !== 0) {
    const simple = { n: result.n / g, d: result.d / g }
    steps.push({
      say: T(
        `${show(result)} se puede simplificar: dividimos arriba y abajo entre ${g} y queda ${show(simple)}. ` +
          `¡Es la misma cantidad de pizza, solo con rebanadas más grandes!`,
        `${show(result)} can be simplified: we divide the top and bottom by ${g} and get ${show(simple)}. ` +
          `It is the same amount of pizza, just with bigger slices!`,
      ),
      ...write(`${show(result)} = (${result.n} ÷ ${g})/(${result.d} ÷ ${g}) = ${show(simple)}`),
      visual: pizzas([{ f: result }, { f: simple }], ['=']),
    })
    result = simple
  }

  // Mas de una pizza: enteros y fraccion
  let answer = show(result)
  if (result.d > 1 && result.n > result.d) {
    const wholes = Math.floor(result.n / result.d)
    const rest = { n: result.n % result.d, d: result.d }
    answer = `${show(result)} = ${wholes} ${T('y', 'and')} ${show(rest)}`
    steps.push({
      say: T(
        `${show(result)} es más de una pizza: son ${wholes} ${pizzaWord(wholes)} y ${show(rest)} de otra.`,
        `${show(result)} is more than one pizza: that is ${wholes} ${pizzaWord(wholes)} and ${show(rest)} of another.`,
      ),
      ...write(answer, 'result'),
      visual: pizzas([{ f: result }], []),
    })
  }

  // Equivalente en decimales cuando es exacto (denominador con solo 2 y 5)
  const exactDecimal = (d: number) => { while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1 }
  const decimal = result.d > 1 && exactDecimal(result.d) ? ` ${T('En decimales es', 'As a decimal it is')} ${Number((result.n / result.d).toFixed(6))}.` : ''
  steps.push({ say: `${T('¡Listo!', 'Done!')} ${title} = ${answer}.${decimal} 🎉`, add: [] })
  const longest = Math.max(...steps.flatMap(s => s.add).map(i => (i.kind === 'text' ? i.text.length : 0)), 10)
  return { title, cols: Math.ceil(longest / 1.6) + 1, rows: row, steps, answer }

  function addSub(a: Frac, b: Frac, op: '+' | '-'): Frac {
    const verb = op === '+' ? T('sumar', 'add') : T('restar', 'subtract')
    let x = a
    let y = b
    if (a.d !== b.d && (a.d === 1 || b.d === 1)) {
      const whole = a.d === 1 ? a : b
      const other = a.d === 1 ? b : a
      const conv = { n: whole.n * other.d, d: other.d }
      steps.push({
        say: T(
          `El ${whole.n} son ${whole.n} ${pizzaWord(whole.n)}. Para ${verb} con ${sliceOf(other.d)}, ` +
            `cortamos cada pizza en ${other.d} rebanadas: ${whole.n} × ${other.d} = ${conv.n} rebanadas. Así ${whole.n} = ${show(conv)}.`,
          `The ${whole.n} is ${whole.n} ${pizzaWord(whole.n)}. To ${verb} with ${sliceOf(other.d)}, ` +
            `we cut each pizza into ${other.d} slices: ${whole.n} × ${other.d} = ${conv.n} slices. So ${whole.n} = ${show(conv)}.`,
        ),
        ...write(`${whole.n} = (${whole.n} × ${other.d})/${other.d} = ${show(conv)}`),
        visual: pizzas([{ f: whole, label: String(whole.n) }, { f: conv }], ['=']),
      })
      if (a.d === 1) x = conv
      else y = conv
    } else if (a.d !== b.d) {
      const m = lcm(a.d, b.d)
      steps.push({
        say: T(
          `Para ${verb}, las rebanadas tienen que ser del mismo tamaño, y ${sliceOf(a.d)} y ${sliceOf(b.d)} no lo son. ` +
            `Buscamos un número que esté en la tabla del ${a.d} y en la del ${b.d}: el ${m}.`,
          `To ${verb}, the slices have to be the same size, and ${sliceOf(a.d)} and ${sliceOf(b.d)} are not. ` +
            `We look for a number that is in both the ${a.d} times table and the ${b.d} times table: ${m}.`,
        ),
        ...write(
          `${T('Tabla del', 'Multiples of')} ${a.d}: ${multiples(a.d, m).join(', ')}   ·   ${T('Tabla del', 'Multiples of')} ${b.d}: ${multiples(b.d, m).join(', ')}`,
          'muted',
        ),
      })
      for (const [f, which] of [[a, 'x'], [b, 'y']] as const) {
        if (f.d === m) continue
        const k = m / f.d
        const conv = { n: f.n * k, d: m }
        steps.push({
          say: T(
            `Cortamos cada rebanada de ${show(f)} en ${k}: ahora la pizza tiene ${m} rebanadas y tomamos ${conv.n}. ` +
              `Multiplicamos arriba y abajo por ${k}: ${show(f)} = ${show(conv)}.`,
            `We cut each slice of ${show(f)} into ${k}: now the pizza has ${m} slices and we take ${conv.n}. ` +
              `We multiply the top and bottom by ${k}: ${show(f)} = ${show(conv)}.`,
          ),
          ...write(`${show(f)} = (${f.n} × ${k})/(${f.d} × ${k}) = ${show(conv)}`),
          visual: pizzas([{ f }, { f: conv }], ['=']),
        })
        if (which === 'x') x = conv
        else y = conv
      }
    }
    const r = op === '+' ? x.n + y.n : x.n - y.n
    const res = { n: r, d: x.d }
    steps.push({
      say: op === '+'
        ? T(
          `Ahora las rebanadas son iguales: juntamos ${x.n} y ${y.n} rebanadas, son ${r}. El de abajo no cambia: siguen siendo ${sliceOf(x.d)}.`,
          `Now the slices are equal: we put ${x.n} and ${y.n} slices together, that makes ${r}. The bottom number does not change: they are still ${sliceOf(x.d)}.`,
        )
        : r >= 0
          ? T(
            `Ahora las rebanadas son iguales: de ${x.n} rebanadas quitamos ${y.n}, quedan ${r}. El de abajo no cambia.`,
            `Now the slices are equal: from ${x.n} slices we take away ${y.n}, leaving ${r}. The bottom number does not change.`,
          )
          : T(
            `De ${x.n} rebanadas no podemos quitar ${y.n}: el resultado es negativo, ${r}/${x.d}.`,
            `We cannot take ${y.n} away from ${x.n} slices: the result is negative, ${r}/${x.d}.`,
          ),
      ...write(`${show(x)} ${sym[op]} ${show(y)} = ${show(res)}`),
      visual: op === '+'
        ? pizzas([{ f: x }, { f: y }, { f: res, second: y.n }], ['+', '='])
        : r >= 0 ? pizzas([{ f: x, removed: y.n }, { f: res }], ['→']) : undefined,
    })
    return res
  }

  function multiply(a: Frac, b: Frac): Frac {
    // Entero por fraccion: sumar la fraccion varias veces
    const [k, f] = a.d === 1 ? [a.n, b] : b.d === 1 ? [b.n, a] : [0, a]
    if (k > 0 && k <= 4) {
      const res = { n: f.n * k, d: f.d }
      steps.push({
        say: T(
          `${k} × ${show(f)} es juntar ${k} veces ${show(f)}: ${Array(k).fill(f.n).join(' + ')} = ${res.n} rebanadas de ${f.d}.`,
          `${k} × ${show(f)} means putting together ${k} copies of ${show(f)}: ${Array(k).fill(f.n).join(' + ')} = ${res.n} slices, each pizza cut into ${f.d}.`,
        ),
        ...write(`${k} × ${show(f)} = ${Array(k).fill(show(f)).join(' + ')} = ${show(res)}`),
        visual: pizzas([...Array.from({ length: k }, () => ({ f })), { f: res }], [...Array(k - 1).fill('+'), '=']),
      })
      return res
    }
    const res = { n: a.n * b.n, d: a.d * b.d }
    if (a.d > 1 && b.d > 1 && a.n <= a.d && b.n <= b.d && a.d <= 12 && b.d <= 12) {
      steps.push({
        say: T(
          `Dibujamos un rectángulo y lo partimos en ${b.d} columnas. Pintamos ${b.n}: eso es ${show(b)}.`,
          `We draw a rectangle and split it into ${b.d} columns. We color ${b.n}: that is ${show(b)}.`,
        ),
        add: [],
        visual: { kind: 'grid', rows: a.d, cols: b.d, rowsFilled: 0, colsFilled: b.n },
      })
      steps.push({
        say: T(
          `Ahora tomamos ${show(a)} de eso: partimos en ${a.d} filas y pintamos ${a.n}. ` +
            `Donde se cruzan los dos colores está la respuesta: ${res.n} de ${res.d} cuadritos.`,
          `Now we take ${show(a)} of that: we split it into ${a.d} rows and color ${a.n}. ` +
            `Where the two colors cross is the answer: ${res.n} out of ${res.d} little squares.`,
        ),
        ...write(`${show(a)} × ${show(b)} = (${a.n} × ${b.n})/(${a.d} × ${b.d}) = ${show(res)}`),
        visual: { kind: 'grid', rows: a.d, cols: b.d, rowsFilled: a.n, colsFilled: b.n },
      })
    } else {
      steps.push({
        say: T(
          `Para multiplicar fracciones multiplicamos arriba por arriba y abajo por abajo.`,
          `To multiply fractions, we multiply top by top and bottom by bottom.`,
        ),
        ...write(`${show(a)} × ${show(b)} = (${a.n} × ${b.n})/(${a.d} × ${b.d}) = ${show(res)}`),
      })
    }
    return res
  }

  function divide(a: Frac, b: Frac): Frac {
    if (b.n === 0) {
      steps.push({ say: T('No se puede dividir entre 0.', 'We cannot divide by 0.'), add: [] })
      return { n: 0, d: 1 }
    }
    const flipped = { n: b.d, d: b.n }
    const res = fromQ(div(toQ(a), toQ(b)))
    const raw = { n: a.n * flipped.n, d: a.d * flipped.d }
    const fits = res.d === 1
      ? T(`¿Cuántas veces cabe ${show(b)} en ${show(a)}? ¡${res.n} veces! `, `How many times does ${show(b)} fit into ${show(a)}? ${res.n} times! `)
      : ''
    steps.push({
      say: fits + T(
        `Para dividir fracciones volteamos la segunda (${show(b)} se vuelve ${show(flipped)}) y multiplicamos.`,
        `To divide fractions, we flip the second one (${show(b)} becomes ${show(flipped)}) and multiply.`,
      ),
      ...write(`${show(a)} ÷ ${show(b)} = ${show(a)} × ${show(flipped)} = (${a.n} × ${flipped.n})/(${a.d} × ${flipped.d}) = ${show(raw)}`),
    })
    return raw
  }
}
