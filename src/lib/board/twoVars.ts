// Ecuaciones lineales con dos incognitas (2x + 3y = 6): tienen muchas soluciones.
// La app despeja una letra y busca parejas que cumplen la ecuacion, sin saltarse pasos.

import { fromLatex } from './expression'
import type { Q } from './rational'
import { add, div, eq, isInt, isZero, mul, neg, q, show, sub, value } from './rational'
import type { BoardItem, BoardScript, BoardStep } from './types'
import { pick, type Lang } from './lang'

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

/** Limpia el texto como lo escribe un nino: acentos, signos raros, comas decimales, espacios */
export function normalizeLinear(input: string): string {
  let s = fromLatex(input).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  s = s.replace(/^(resuelve|calcula)\s*:?\s*/, '')
  return s.replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, '')
}

/** Ecuacion lineal ya normalizada -> coeficientes de cada letra (todo pasado a la izquierda) y numero de la derecha */
export function parseLinear(s: string): { coef: Record<string, Q>; c: Q } | null {
  const sides = s.split('=')
  if (sides.length !== 2) return null

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
  const coef: Record<string, Q> = {}
  for (const v of new Set([...Object.keys(l.coef), ...Object.keys(r.coef)])) {
    coef[v] = sub(l.coef[v] ?? ZERO, r.coef[v] ?? ZERO)
  }
  return { coef, c: sub(r.num, l.num) }
}

export function parseTwoVarEquation(input: string): TwoVarEquation | null {
  const s = normalizeLinear(input)
  const letters = [...new Set(s.match(/[a-z]/g) ?? [])].sort()
  if (letters.length !== 2) return null
  const p = parseLinear(s)
  if (!p) return null
  const [x, y] = letters
  const a = p.coef[x] ?? ZERO
  const b = p.coef[y] ?? ZERO
  if (isZero(a) || isZero(b)) return null
  return { a, b, c: p.c, x, y, text: input.trim() }
}

export const txt = (n: Q) => show(n).replace('-', '−')
/** Numero dentro de una cuenta: los negativos van entre parentesis */
export const inner = (n: Q) => (value(n) < 0 ? `(${txt(n)})` : txt(n))
/** "2x", "x", "−x", "3/2y" */
export const term = (k: Q, v: string) => (eq(k, ONE) ? v : eq(k, neg(ONE)) ? `−${v}` : `${txt(k)}${v}`)

/** "6 − 2x", "−6 + 2x", "−2x" (primero el numero, como se lee al despejar) */
function constMinus(c: Q, k: Q, v: string): string {
  const abs = term(value(k) < 0 ? neg(k) : k, v)
  if (isZero(c)) return value(k) > 0 ? `−${abs}` : abs
  return `${txt(c)} ${value(k) > 0 ? '−' : '+'} ${abs}`
}

export function twoVarScript(e: TwoVarEquation, lang: Lang = 'es'): BoardScript {
  const T = pick(lang)
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
    say: T(
      `Esta ecuación tiene dos letras: la ${x} y la ${y}. Con una sola ecuación no hay un único resultado: ` +
        `hay muchas parejas de números que la cumplen. Vamos a despejar la ${y} y después buscar parejas.`,
      `This equation has two letters: ${x} and ${y}. With only one equation there is no single answer: ` +
        `many pairs of numbers make it true. We are going to solve for ${y} and then look for pairs.`,
    ),
    ...write(original, 'op'),
  })

  const ordered = `${lhs} = ${txt(c)}`
  const norm = (t: string) => t.replace(/\s/g, '').replace(/−/g, '-')
  if (norm(ordered) !== norm(original)) {
    steps.push({
      say: T(
        `Acomodamos la ecuación: las letras de un lado y el número solo del otro.`,
        `We rearrange the equation: the letters on one side and the number alone on the other.`,
      ),
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
      ? T(
          `Queremos la ${y} sola. Quitamos ${ax} de los dos lados, así la ecuación sigue en equilibrio.`,
          `We want ${y} on its own. We take away ${ax} from both sides, so the equation stays balanced.`,
        )
      : T(
          `Queremos la ${y} sola. Sumamos ${ax} a los dos lados para cancelarlo.`,
          `We want ${y} on its own. We add ${ax} to both sides to cancel it.`,
        ),
    ...write(`${lhs} ${value(a) > 0 ? '−' : '+'} ${ax} = ${txt(c)} ${value(a) > 0 ? '−' : '+'} ${ax}`),
  })
  steps.push({ say: T(`Nos queda ${term(k, y)} = ${constMinus(rc, rx, x)}.`, `We are left with ${term(k, y)} = ${constMinus(rc, rx, x)}.`), ...write(`${term(k, y)} = ${constMinus(rc, rx, x)}`) })

  if (value(k) < 0) {
    k = neg(k)
    rc = neg(rc)
    rx = neg(rx)
    steps.push({
      say: T(
        `La ${y} tiene signo menos. Cambiamos el signo de todo (multiplicamos los dos lados por −1).`,
        `${y} has a minus sign. We change the sign of everything (we multiply both sides by −1).`,
      ),
      ...write(`${term(k, y)} = ${constMinus(rc, rx, x)}`),
    })
  }

  const isOne = eq(k, ONE)
  const formula = isOne ? `${y} = ${constMinus(rc, rx, x)}` : `${y} = (${constMinus(rc, rx, x)}) ÷ ${txt(k)}`
  if (!isOne) {
    steps.push({
      say: T(
        `Hay ${txt(k)} ${y}. Dividimos los dos lados entre ${txt(k)} para dejar una sola ${y}.`,
        `There are ${txt(k)} ${y}'s. We divide both sides by ${txt(k)} to leave a single ${y}.`,
      ),
      ...write(formula, 'result'),
    })
  } else {
    steps.push({
      say: T(
        `¡La ${y} ya está sola! Esta regla nos da la ${y} para cualquier ${x}.`,
        `${y} is on its own now! This rule gives us ${y} for any ${x}.`,
      ),
      ...write(formula, 'result'),
    })
  }

  // Buscar parejas: cambiar la x por un numero y hacer las cuentas una por una
  const pairs: Array<[Q, Q]> = []
  const wrap = (s: string) => (isOne ? s : `(${s}) ÷ ${txt(k)}`)
  const yOf = (xv: Q) => div(sub(rc, mul(rx, xv)), k)
  const inside = constMinus(rc, rx, x)
  const where = isOne ? inside : T(`lo de adentro del paréntesis (${inside})`, `what is inside the parentheses (${inside})`)

  // Por que se escoge cada numero: primero el 0, despues el que deja la y en 0 o una division exacta
  const choose = (first: boolean): Q => {
    if (first) {
      steps.push({
        say: T(
          `Ahora buscamos parejas. La ${x} puede valer cualquier número, así que escogemos el más fácil: el 0. ` +
            `¿Por qué? Porque cualquier número por 0 da 0, y así la ${x} desaparece de la cuenta.`,
          `Now we look for pairs. ${x} can be any number, so we pick the easiest one: 0. ` +
            `Why? Because any number times 0 is 0, so ${x} disappears from the calculation.`,
        ),
        ...write(T(`¿Por qué ${x} = 0? Todo número × 0 = 0, es el más fácil`, `Why ${x} = 0? Any number × 0 = 0, it is the easiest`), 'muted'),
      })
      return ZERO
    }
    const root = div(rc, rx)
    if (!isZero(root) && isInt(root) && Math.abs(value(root)) <= 50) {
      const m = value(rx) < 0 ? neg(rx) : rx
      const target = value(rx) < 0 ? neg(rc) : rc
      steps.push({
        say: T(
          `Para otra pareja buscamos la ${x} que hace que la ${y} valga 0, porque así las cuentas quedan muy fáciles. ` +
            `Para eso ${where} tiene que valer 0.`,
          `For another pair we look for the ${x} that makes ${y} equal 0, because that makes the math very easy. ` +
            `For that, ${where} has to equal 0.`,
        ),
        ...write(T(`¿Qué ${x} hace ${y} = 0?  ${inside} = 0`, `Which ${x} makes ${y} = 0?  ${inside} = 0`), 'muted'),
      })
      steps.push({
        say: value(rx) > 0
          ? T(
              `Para que ${inside} dé 0, ${term(m, x)} tiene que valer lo mismo que ${txt(rc)}.`,
              `For ${inside} to equal 0, ${term(m, x)} has to equal ${txt(rc)}.`,
            )
          : T(
              `Para que ${inside} dé 0, ${term(m, x)} tiene que valer ${txt(target)}.`,
              `For ${inside} to equal 0, ${term(m, x)} has to equal ${txt(target)}.`,
            ),
        ...write(`${term(m, x)} = ${txt(target)}`, 'muted'),
      })
      if (!eq(m, ONE)) {
        steps.push({
          say: T(
            `Repartimos ${txt(target)} entre ${txt(m)}: ${txt(target)} ÷ ${txt(m)} = ${txt(root)}. ¡Ya tenemos la ${x}!`,
            `We share ${txt(target)} among ${txt(m)}: ${txt(target)} ÷ ${txt(m)} = ${txt(root)}. Now we have ${x}!`,
          ),
          ...write(`${x} = ${txt(target)} ÷ ${txt(m)} = ${txt(root)}`, 'muted'),
        })
      }
      return root
    }
    if (isOne) {
      steps.push({
        say: T(
          `Para otra pareja escogemos otro número fácil para la ${x}: el 1. Como no hay que dividir, cualquier número sirve.`,
          `For another pair we pick another easy number for ${x}: 1. Since there is nothing to divide, any number works.`,
        ),
        ...write(T(`Otra pareja: escogemos ${x} = 1, otro número fácil`, `Another pair: we pick ${x} = 1, another easy number`), 'muted'),
      })
      return ONE
    }
    // Probar numeros chicos hasta que la division entre k salga exacta
    steps.push({
      say: T(
        `Para otra pareja queremos que la división entre ${txt(k)} salga exacta. Probamos números pequeños para la ${x}.`,
        `For another pair we want the division by ${txt(k)} to come out exact. We try small numbers for ${x}.`,
      ),
      ...write(T(`Buscamos una ${x} con ${inside} que se divida exacto entre ${txt(k)}`, `We look for an ${x} where ${inside} divides evenly by ${txt(k)}`), 'muted'),
    })
    const tries = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map(n => q(n))
    const found = tries.find(t => isInt(yOf(t)))
    let shown = 0
    for (const t of tries) {
      if (found && eq(t, found)) break
      if (shown++ === 3) {
        steps.push({ say: T('Seguimos probando más números...', 'We keep trying more numbers...'), ...write('…', 'muted') })
        break
      }
      const r = sub(rc, mul(rx, t))
      steps.push({
        say: T(
          `Con ${x} = ${txt(t)}: ${txt(r)} ÷ ${txt(k)} no sale exacto. Probamos otro.`,
          `With ${x} = ${txt(t)}: ${txt(r)} ÷ ${txt(k)} does not come out exact. We try another one.`,
        ),
        ...write(T(`${x} = ${txt(t)}: ${txt(r)} ÷ ${txt(k)} no es exacto ✗`, `${x} = ${txt(t)}: ${txt(r)} ÷ ${txt(k)} is not exact ✗`), 'muted'),
      })
    }
    if (!found) {
      steps.push({
        say: T(
          `Ningún número pequeño da una división exacta, así que usamos ${x} = 1 y la ${y} saldrá en fracción.`,
          `No small number gives an exact division, so we use ${x} = 1 and ${y} will come out as a fraction.`,
        ),
        ...write(T(`Usamos ${x} = 1 (la ${y} sale en fracción)`, `We use ${x} = 1 (${y} comes out as a fraction)`), 'muted'),
      })
      return ONE
    }
    const r = sub(rc, mul(rx, found))
    steps.push({
      say: T(
        `Con ${x} = ${txt(found)}: ${txt(r)} ÷ ${txt(k)} sí sale exacto. ¡Usamos ese!`,
        `With ${x} = ${txt(found)}: ${txt(r)} ÷ ${txt(k)} does come out exact. We use that one!`,
      ),
      ...write(T(`${x} = ${txt(found)}: ${txt(r)} ÷ ${txt(k)} sí es exacto ✔`, `${x} = ${txt(found)}: ${txt(r)} ÷ ${txt(k)} is exact ✔`), 'muted'),
    })
    return found
  }

  for (const first of [true, false]) {
    const xv = choose(first)
    const prod = mul(rx, xv)
    const rest = sub(rc, prod)
    const yv = div(rest, k)
    const op = value(rx) > 0 ? '−' : '+'
    const absRx = value(rx) < 0 ? neg(rx) : rx
    const absProd = value(rx) < 0 ? neg(prod) : prod
    steps.push({
      say: T(
        `Cambiamos la ${x} por ${txt(xv)} en la regla ${formula}. Donde decía ${term(absRx, x)} ahora dice ${txt(absRx)} × ${inner(xv)}.`,
        `We replace ${x} with ${txt(xv)} in the rule ${formula}. Where it said ${term(absRx, x)} it now says ${txt(absRx)} × ${inner(xv)}.`,
      ),
      ...write(`${T('Si', 'If')} ${x} = ${txt(xv)}:  ${y} = ${wrap(`${txt(rc)} ${op} ${txt(absRx)} × ${inner(xv)}`)}`),
    })
    steps.push({
      say: T(
        `Primero la multiplicación: ${txt(absRx)} × ${inner(xv)} = ${txt(absProd)}.`,
        `First the multiplication: ${txt(absRx)} × ${inner(xv)} = ${txt(absProd)}.`,
      ),
      ...write(`${y} = ${wrap(`${txt(rc)} ${op} ${inner(absProd)}`)}`),
    })
    steps.push({
      say: T(`Ahora ${txt(rc)} ${op} ${inner(absProd)} = ${txt(rest)}.`, `Now ${txt(rc)} ${op} ${inner(absProd)} = ${txt(rest)}.`),
      ...write(isOne ? `${y} = ${txt(rest)}` : `${y} = ${txt(rest)} ÷ ${txt(k)}`, isOne ? 'result' : 'line-text'),
    })
    if (!isOne) {
      steps.push({ say: T(`Y ${txt(rest)} ÷ ${txt(k)} = ${txt(yv)}.`, `And ${txt(rest)} ÷ ${txt(k)} = ${txt(yv)}.`), ...write(`${y} = ${txt(yv)}`, 'result') })
    }
    steps.push({
      say: T(
        `Comprobamos: en la ecuación del principio cambiamos la ${x} por ${txt(xv)} y la ${y} por ${txt(yv)}. ` +
          `${txt(a)} × ${inner(xv)} + ${inner(b)} × ${inner(yv)} = ${txt(c)}. ¡Se cumple! Una pareja es ${x} = ${txt(xv)}, ${y} = ${txt(yv)}. ✔`,
        `Let's check: in the original equation we replace ${x} with ${txt(xv)} and ${y} with ${txt(yv)}. ` +
          `${txt(a)} × ${inner(xv)} + ${inner(b)} × ${inner(yv)} = ${txt(c)}. It works! One pair is ${x} = ${txt(xv)}, ${y} = ${txt(yv)}. ✔`,
      ),
      ...write(`${txt(a)} × ${inner(xv)} + ${inner(b)} × ${inner(yv)} = ${txt(c)}  ✔`, 'muted'),
    })
    pairs.push([xv, yv])
  }

  const ex = pairs.map(([xv, yv]) => `${x} = ${txt(xv)}, ${y} = ${txt(yv)}`).join(T(' o ', ' or '))
  const answer = T(`${formula} (por ejemplo ${ex})`, `${formula} (for example ${ex})`)
  steps.push({
    say: T(
      `¡Listo! La regla es ${formula}. Con cualquier ${x} sale su ${y}; por ejemplo ${ex}. 🎉`,
      `Done! The rule is ${formula}. Any ${x} gives its ${y}; for example ${ex}. 🎉`,
    ),
    ...write(`✔ ${answer}`, 'result'),
  })

  const longest = Math.max(...steps.flatMap(s => s.add).map(i => (i.kind === 'text' ? i.text.length : 0)), 10)
  return { title: e.text, cols: Math.ceil(longest / 1.6) + 1, rows: row, steps, answer }
}
