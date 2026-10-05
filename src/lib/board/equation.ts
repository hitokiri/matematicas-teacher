// Ecuaciones de primer grado con una incognita (2x + 4 = 10, 3x + 2 = x + 10, 2(x + 3) = 14)
// resueltas por la app con el metodo de la balanza: lo que se hace de un lado se hace del otro.

import { fromLatex } from './expression'
import type { Q } from './rational'
import { add, div, eq, isInt, isZero, mul, neg, q, show, signed, sub, value } from './rational'
import type { BoardItem, BoardScript, BoardStep, PanItem, Visual } from './types'

/** Expresion lineal: a·x + b */
interface Lin {
  a: Q
  b: Q
}

export interface Equation {
  left: Lin
  right: Lin
  variable: string
  /** Algun lado tenia parentesis con la incognita (hay que quitarlos) */
  hadParens: boolean
  text: string
}

const lin = (a: Q, b: Q): Lin => ({ a, b })
const ZERO = q(0)

type Tok = { t: 'num'; v: Q } | { t: 'var' } | { t: 'op'; v: string } | { t: 'lp' } | { t: 'rp' }

export function parseEquation(input: string): Equation | null {
  let s = fromLatex(input).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  s = s.replace(/^(resuelve|encuentra x|calcula)\s*:?\s*/, '')
  s = s.replace(/[−–—]/g, '-').replace(/[×·*]/g, '*').replace(/[÷:]/g, '/').replace(/(\d),(\d)/g, '$1.$2')
  const sides = s.split('=')
  if (sides.length !== 2) return null
  const letters = [...new Set(s.match(/[a-z]/g) ?? [])]
  if (letters.length !== 1) return null
  const variable = letters[0]
  let hadParens = false

  const tokenize = (side: string): Tok[] | null => {
    const out: Tok[] = []
    const t = side.replace(/\s+/g, '')
    for (let i = 0; i < t.length; ) {
      const num = t.slice(i).match(/^\d+(\.\d+)?/)
      if (num) {
        out.push({ t: 'num', v: q(Number(num[0])) })
        i += num[0].length
        continue
      }
      const c = t[i]
      if (c === variable) {
        // "3x4" con la x como signo de multiplicar entre numeros
        if (variable === 'x' && out[out.length - 1]?.t === 'num' && /\d/.test(t[i + 1] ?? '')) out.push({ t: 'op', v: '*' })
        else out.push({ t: 'var' })
      } else if ('+-*/'.includes(c)) out.push({ t: 'op', v: c })
      else if (c === '(') out.push({ t: 'lp' })
      else if (c === ')') out.push({ t: 'rp' })
      else return null
      i++
    }
    return out
  }

  const parseSide = (toks: Tok[]): Lin | null => {
    let pos = 0
    const fail = (): never => { throw new Error('parse') }
    const expr = (): Lin => {
      let v = term()
      for (let t = toks[pos]; t?.t === 'op' && (t.v === '+' || t.v === '-'); t = toks[pos]) {
        pos++
        const r = term()
        v = t.v === '+' ? lin(add(v.a, r.a), add(v.b, r.b)) : lin(sub(v.a, r.a), sub(v.b, r.b))
      }
      return v
    }
    const term = (): Lin => {
      let v = factor()
      for (;;) {
        const t = toks[pos]
        const implicit = t && (t.t === 'var' || t.t === 'lp' || t.t === 'num')
        if (t?.t === 'op' && (t.v === '*' || t.v === '/')) pos++
        else if (!implicit) return v
        const op = t.t === 'op' ? t.v : '*'
        const r = factor()
        if (op === '*') {
          // Lineal: no se permite x · x
          if (!isZero(v.a) && !isZero(r.a)) fail()
          v = !isZero(v.a) ? lin(mul(v.a, r.b), mul(v.b, r.b)) : lin(mul(r.a, v.b), mul(r.b, v.b))
        } else {
          if (!isZero(r.a) || isZero(r.b)) fail()
          v = lin(div(v.a, r.b), div(v.b, r.b))
        }
      }
    }
    const factor = (): Lin => {
      const t = toks[pos++]
      if (!t) return fail()
      if (t.t === 'num') return lin(ZERO, t.v)
      if (t.t === 'var') return lin(q(1), ZERO)
      if (t.t === 'op' && t.v === '-') {
        const f = factor()
        return lin(neg(f.a), neg(f.b))
      }
      if (t.t === 'lp') {
        const v = expr()
        if (toks[pos++]?.t !== 'rp') fail()
        if (!isZero(v.a) && !isZero(v.b)) hadParens = true
        return v
      }
      return fail()
    }
    try {
      const v = expr()
      return pos === toks.length ? v : null
    } catch {
      return null
    }
  }

  const lt = tokenize(sides[0])
  const rt = tokenize(sides[1])
  if (!lt?.length || !rt?.length) return null
  const left = parseSide(lt)
  const right = parseSide(rt)
  if (!left || !right) return null
  if (isZero(left.a) && isZero(right.a)) return null
  return { left, right, variable, hadParens, text: input.trim() }
}

/** "2x + 4", "x", "−x", "4", "3/2x − 1" */
function showLin(l: Lin, v: string): string {
  const xPart = isZero(l.a) ? '' : eq(l.a, q(1)) ? v : eq(l.a, q(-1)) ? `−${v}` : `${show(l.a).replace('-', '−')}${v}`
  if (!xPart) return show(l.b).replace('-', '−')
  if (isZero(l.b)) return xPart
  return `${xPart} ${signed(l.b)}`
}

const MAX_ITEMS = 10

/** Cosas de un platillo: bolsas x y pesas (individuales si son pocas, si no un bloque con el numero) */
function pan(l: Lin, v: string, opts: { removeX?: Q; removeUnits?: Q; groups?: number } = {}): PanItem[] {
  const items: PanItem[] = []
  const push = (kind: 'x' | 'unit', amount: Q, removedAmount?: Q) => {
    if (isZero(amount)) return
    const n = value(amount)
    const rem = removedAmount ? value(removedAmount) : 0
    const single = kind === 'x' ? v : '1'
    if (isInt(amount) && n > 0 && n <= MAX_ITEMS && (!removedAmount || (isInt(removedAmount) && rem <= n))) {
      for (let i = 0; i < n; i++) {
        const group = opts.groups ? Math.floor(i / (n / opts.groups)) : undefined
        items.push({ kind, label: single, removed: i >= n - rem, group })
      }
    } else {
      const label = kind === 'x' ? showLin(lin(amount, ZERO), v) : show(amount).replace('-', '−')
      items.push({ kind, label, removed: !!removedAmount && eq(removedAmount, amount) })
      if (removedAmount && !eq(removedAmount, amount)) {
        items.push({ kind, label: show(neg(removedAmount)).replace('-', '−'), removed: false })
      }
    }
  }
  push('x', l.a, opts.removeX)
  push('unit', l.b, opts.removeUnits)
  return items
}

const balance = (left: PanItem[], right: PanItem[], groups?: number): Visual => ({ kind: 'balance', left, right, groups })

export function equationScript(e: Equation): BoardScript {
  const v = e.variable
  let n = 0
  let row = 0
  const steps: BoardStep[] = []
  const line = (text: string, tone: 'op' | 'line-text' | 'result' | 'muted' = 'line-text'): BoardItem =>
    ({ id: `q${n++}`, kind: 'text', row: row++, col: 0, text, tone, align: 'start' })
  const write = (text: string, tone?: 'op' | 'line-text' | 'result' | 'muted') => {
    const item = line(text, tone)
    return { add: [item], focus: [[(item as { row: number }).row, 0]] as Array<[number, number]> }
  }

  let L = e.left
  let R = e.right
  const eqText = () => `${showLin(L, v)} = ${showLin(R, v)}`

  steps.push({
    say: `Una ecuación es como una balanza en equilibrio: los dos lados pesan lo mismo. ` +
      `La ${v} es una bolsa con un peso que no conocemos. ¡Vamos a descubrir cuánto pesa!`,
    add: [line(e.text.replace(/\s*=\s*/, ' = '), 'op')],
    visual: e.hadParens ? undefined : balance(pan(L, v), pan(R, v)),
  })

  if (e.hadParens) {
    steps.push({
      say: 'Primero quitamos el paréntesis: el número de afuera multiplica a cada cosa de adentro.',
      ...write(eqText()),
      visual: balance(pan(L, v), pan(R, v)),
    })
  }

  // Dejar las x del lado que tiene mas (asi el numero de bolsas queda positivo)
  if (value(L.a) < value(R.a)) {
    ;[L, R] = [R, L]
    steps.push({
      say: `Hay más bolsas ${v} del lado derecho, así que volteamos la balanza: es lo mismo leerla al revés.`,
      ...write(eqText()),
      visual: balance(pan(L, v), pan(R, v)),
    })
  }

  // Quitar las x del lado derecho
  if (!isZero(R.a)) {
    const c = R.a
    const what = showLin(lin(c, ZERO), v)
    steps.push({
      say: `Hay bolsas ${v} en los dos lados. Quitamos ${what} de cada lado, así la balanza sigue en equilibrio.`,
      ...write(`${showLin(L, v)} − ${what} = ${showLin(R, v)} − ${what}`),
      visual: balance(pan(L, v, { removeX: c }), pan(R, v, { removeX: c })),
    })
    L = lin(sub(L.a, c), L.b)
    R = lin(ZERO, R.b)
    steps.push({ say: `Nos queda ${eqText()}.`, ...write(eqText()), visual: balance(pan(L, v), pan(R, v)) })
  }

  if (isZero(L.a)) {
    const same = eq(L.b, R.b)
    steps.push({
      say: same
        ? `Las bolsas se fueron y quedó ${show(L.b)} = ${show(R.b)}, que siempre es cierto: cualquier número sirve.`
        : `Las bolsas se fueron y quedó ${show(L.b)} = ${show(R.b)}, que nunca es cierto: la ecuación no tiene solución.`,
      add: [],
    })
    return finish(steps, row, same ? 'Cualquier número' : 'No tiene solución', e)
  }

  // Quitar el numero que acompana a las x
  if (!isZero(L.b)) {
    const b = L.b
    const positive = value(b) > 0
    const abs = show(positive ? b : neg(b))
    steps.push({
      say: positive
        ? `Junto a las bolsas hay ${abs}. Quitamos ${abs} de cada lado de la balanza: sigue en equilibrio y la ${v} queda más sola.`
        : `Del lado de la ${v} están restando ${abs}. Sumamos ${abs} a los dos lados para cancelarlo.`,
      ...write(`${showLin(L, v)} ${positive ? '−' : '+'} ${abs} = ${showLin(R, v)} ${positive ? '−' : '+'} ${abs}`),
      visual: positive
        ? balance(pan(L, v, { removeUnits: b }), pan(R, v, { removeUnits: b }))
        : balance(pan(L, v), pan(R, v)),
    })
    L = lin(L.a, ZERO)
    R = lin(ZERO, sub(R.b, b))
    steps.push({ say: `Nos queda ${eqText()}.`, ...write(eqText()), visual: balance(pan(L, v), pan(R, v)) })
  }

  // Repartir entre el numero de bolsas
  if (!eq(L.a, q(1))) {
    const a = L.a
    const total = R.b
    const result = div(total, a)
    let say: string
    let text: string
    if (isInt(a) && value(a) > 0) {
      say = `Ahora ${show(a)} bolsas ${v} pesan ${show(total)}. Repartimos ${show(total)} en ${show(a)} partes iguales: cada bolsa pesa ${show(result)}.`
      text = `${showLin(L, v)} ÷ ${show(a)} = ${show(total)} ÷ ${show(a)}`
    } else {
      const inv = div(q(1), a)
      say = `La ${v} está multiplicada por ${show(a)}. Multiplicamos los dos lados por ${show(inv)} para dejarla sola.`
      text = `${showLin(L, v)} × ${show(inv)} = ${show(total)} × ${show(inv)}`
    }
    const groups = isInt(a) && value(a) > 1 && value(a) <= MAX_ITEMS ? value(a) : undefined
    steps.push({ say, ...write(text), visual: balance(pan(L, v, { groups }), pan(R, v, { groups }), groups) })
    L = lin(q(1), ZERO)
    R = lin(ZERO, result)
    steps.push({ say: `¡Encontramos el peso de la bolsa! ${eqText()}.`, ...write(eqText(), 'result'), visual: balance(pan(L, v), pan(R, v)) })
  }

  // Comprobar en la ecuacion original
  const x = R.b
  const evalSide = (l: Lin) => add(mul(l.a, x), l.b)
  const sideText = (l: Lin) => {
    const parts: string[] = []
    if (!isZero(l.a)) parts.push(eq(l.a, q(1)) ? show(x) : `${show(l.a)} × ${show(x)}`)
    if (!isZero(l.b) || !parts.length) parts.push(parts.length ? signed(l.b) : show(l.b))
    return parts.join(' ')
  }
  const lv = evalSide(e.left)
  const rv = evalSide(e.right)
  steps.push({
    say: `Comprobamos: cambiamos la ${v} por ${show(x)} en la ecuación del principio. ` +
      `${sideText(e.left)} = ${show(lv)} y del otro lado ${show(rv)}. ¡Pesan lo mismo! ✔`,
    ...write(`${sideText(e.left)} = ${sideText(e.right)}  ✔`.replace(/-/g, '−'), 'muted'),
  })
  return finish(steps, row, `${v} = ${show(x)}`, e)
}

function finish(steps: BoardStep[], rows: number, answer: string, e: Equation): BoardScript {
  steps.push({ say: `¡Listo! ${answer}. 🎉`, add: [] })
  const longest = Math.max(...steps.flatMap(s => s.add).map(i => (i.kind === 'text' ? i.text.length : 0)), 10)
  return { title: e.text, cols: Math.ceil(longest / 1.6) + 1, rows: Math.max(rows, 1), steps, answer }
}
