// Sistemas de dos ecuaciones con dos incognitas (x + y = 5 y x − y = 1) resueltos por la app.
// Si alguna letra esta sola (sin numero delante) se usa sustitucion; si no, reduccion.
// Cada cuenta va en su propio renglon y la maestra dice por que se escoge cada cosa.

import type { Q } from './rational'
import { add, div, eq, isInt, isZero, lcm, mul, neg, q, sub, value } from './rational'
import type { BoardItem, BoardScript, BoardStep } from './types'
import { inner, normalizeLinear, parseLinear, term, txt } from './twoVars'

interface Eq2 {
  /** a·x + b·y = c */
  a: Q
  b: Q
  c: Q
  text: string
}

export interface LinearSystem {
  eqs: [Eq2, Eq2]
  x: string
  y: string
  text: string
}

const ZERO = q(0)
const ONE = q(1)
const abs = (n: Q) => (value(n) < 0 ? neg(n) : n)

/** Dos ecuaciones separadas por renglon, ";" o ", " (la coma pegada a un numero es decimal) */
export function parseSystem(input: string): LinearSystem | null {
  const parts = input
    .replace(/\\begin\{cases\}|\\end\{cases\}|[{}]/g, '\n')
    .split(/\r?\n|;|\\\\|,\s+/)
    .map(p => p.trim())
    .filter(Boolean)
  if (parts.length !== 2) return null
  const norm = parts.map(normalizeLinear)
  if (norm.some(p => p.split('=').length !== 2)) return null
  const letters = [...new Set(norm.join('').match(/[a-z]/g) ?? [])].sort()
  if (letters.length !== 2) return null
  const [x, y] = letters
  const eqs: Eq2[] = []
  for (let i = 0; i < 2; i++) {
    const p = parseLinear(norm[i])
    if (!p) return null
    const a = p.coef[x] ?? ZERO
    const b = p.coef[y] ?? ZERO
    if (isZero(a) && isZero(b)) return null
    eqs.push({ a, b, c: p.c, text: parts[i] })
  }
  // Sin una letra sola, la reduccion necesita numeros enteros
  const loose = eqs.some(e => [e.a, e.b].some(k => eq(abs(k), ONE)))
  if (!loose && !eqs.every(e => isInt(e.a) && isInt(e.b))) return null
  return { eqs: [eqs[0], eqs[1]], x, y, text: parts.join('\n') }
}

/** "2x + 3y", "x − y", "6 + 3y", "0" */
function sum(terms: Array<[Q, string]>): string {
  let out = ''
  for (const [k, v] of terms) {
    if (isZero(k)) continue
    const piece = v ? term(abs(k), v) : txt(abs(k))
    out += out ? ` ${value(k) < 0 ? '−' : '+'} ${piece}` : v ? term(k, v) : txt(k)
  }
  return out || '0'
}

/** "u = p + r·w" escrito como se lee: "5 − y", "−4 + x", "3" */
function exprText(p: Q, r: Q, w: string): string {
  if (isZero(r)) return txt(p)
  if (isZero(p)) return term(r, w)
  return `${txt(p)} ${value(r) < 0 ? '−' : '+'} ${term(abs(r), w)}`
}

export function systemScript(s: LinearSystem): BoardScript {
  const { x, y } = s
  const [e1, e2] = s.eqs
  let n = 0
  let row = 0
  const steps: BoardStep[] = []
  type Tone = 'op' | 'line-text' | 'result' | 'muted'
  const write = (text: string, tone: Tone = 'line-text') => {
    const item: BoardItem = { id: `s${n++}`, kind: 'text', row, col: 0, text, tone, align: 'start' }
    return { add: [item], focus: [[row++, 0]] as Array<[number, number]> }
  }
  const coefOf = (e: Eq2, v: string) => (v === x ? e.a : e.b)
  const eqText = (e: Eq2) => `${sum([[e.a, x], [e.b, y]])} = ${txt(e.c)}`
  const norm = (t: string) => t.replace(/\s/g, '').replace(/−/g, '-')
  /** Lo que escribio el nino, con el signo menos de la pizarra */
  const show = (t: string) => t.replace(/\s*=\s*/, ' = ').replace(/-/g, '−')

  steps.push({
    say: `Son dos ecuaciones con las mismas dos letras, la ${x} y la ${y}. Buscamos UNA sola pareja de números ` +
      `que cumpla las dos ecuaciones a la vez. A la primera la llamamos (1) y a la segunda (2).`,
    ...write(`(1)  ${show(e1.text)}`, 'op'),
  })
  steps.push({ say: 'Esta es la ecuación (2).', ...write(`(2)  ${show(e2.text)}`, 'op') })
  s.eqs.forEach((e, i) => {
    if (norm(eqText(e)) !== norm(e.text)) {
      steps.push({
        say: `Acomodamos la ecuación (${i + 1}): las letras de un lado y el número solo del otro.`,
        ...write(`(${i + 1})  ${eqText(e)}`),
      })
    }
  })

  /** k·v + p = c  ->  v = ... (pasa el numero y reparte). Devuelve el valor de v */
  const solveOne = (k: Q, v: string, p: Q, c: Q): Q => {
    let r = c
    if (!isZero(p)) {
      const pa = txt(abs(p))
      r = sub(c, p)
      steps.push({
        say: value(p) > 0
          ? `Junto a la ${v} hay un ${pa}. Lo quitamos de los dos lados para dejar la ${v} más sola.`
          : `A la ${v} le están restando ${pa}. Sumamos ${pa} en los dos lados para cancelarlo.`,
        ...write(`${term(k, v)} = ${txt(c)} ${value(p) > 0 ? '−' : '+'} ${pa}`),
      })
      steps.push({
        say: `${txt(c)} ${value(p) > 0 ? '−' : '+'} ${pa} = ${txt(r)}.`,
        ...write(`${term(k, v)} = ${txt(r)}`, eq(k, ONE) ? 'result' : 'line-text'),
      })
    }
    const val = div(r, k)
    if (!eq(k, ONE)) {
      steps.push({
        say: eq(k, neg(ONE))
          ? `Tenemos −${v} = ${txt(r)}. Cambiamos el signo de los dos lados: ${v} = ${txt(val)}.`
          : value(k) < 0
            ? `La ${v} está multiplicada por ${txt(k)}. Dividimos los dos lados entre ${inner(k)}: ${txt(r)} ÷ ${inner(k)} = ${txt(val)}.`
            : `Hay ${txt(k)} veces la ${v}. Repartimos ${txt(r)} entre ${txt(k)}: ${txt(r)} ÷ ${inner(k)} = ${txt(val)}.`,
        ...write(eq(k, neg(ONE)) ? `${v} = ${txt(val)}` : `${v} = ${txt(r)} ÷ ${inner(k)} = ${txt(val)}`, 'result'),
      })
    } else if (isZero(p)) {
      steps.push({ say: `¡Ya sabemos cuánto vale la ${v}!`, ...write(`${v} = ${txt(val)}`, 'result') })
    }
    return val
  }

  /** Cuando una letra se cancela y queda "P = C": siempre cierto (infinitas) o nunca (sin solucion) */
  const degenerate = (left: Q, right: Q): BoardScript => {
    const same = eq(left, right)
    steps.push({
      say: same
        ? `Las letras se fueron y quedó ${txt(left)} = ${txt(right)}, que siempre es cierto: las dos ecuaciones son la misma recta y hay muchísimas parejas.`
        : `Las letras se fueron y quedó ${txt(left)} = ${txt(right)}, que nunca es cierto: no hay ninguna pareja que cumpla las dos.`,
      ...write(`${txt(left)} = ${txt(right)}  ${same ? '✔ siempre' : '✗ nunca'}`, 'result'),
    })
    return finish(same ? 'Tiene infinitas soluciones' : 'No tiene solución')
  }

  const finish = (answer: string): BoardScript => {
    steps.push({ say: `¡Listo! ${answer}. 🎉`, ...write(`✔ ${answer}`, 'result') })
    const longest = Math.max(...steps.flatMap(st => st.add).map(i => (i.kind === 'text' ? i.text.length : 0)), 10)
    return { title: s.text, cols: Math.ceil(longest / 1.6) + 1, rows: row, steps, answer }
  }

  const check = (xv: Q, yv: Q): BoardScript => {
    s.eqs.forEach((e, i) => {
      // 1 × 3 se escribe 3: solo se multiplica cuando hay un numero delante de la letra
      const times = (k: Q, val: Q) => (eq(abs(k), ONE) ? inner(val) : `${txt(abs(k))} × ${inner(val)}`)
      const parts: string[] = []
      if (!isZero(e.a)) parts.push(`${value(e.a) < 0 ? '−' : ''}${times(e.a, xv)}`)
      if (!isZero(e.b)) parts.push(parts.length ? `${value(e.b) < 0 ? '−' : '+'} ${times(e.b, yv)}` : `${value(e.b) < 0 ? '−' : ''}${times(e.b, yv)}`)
      steps.push({
        say: `Comprobamos en la ecuación (${i + 1}): cambiamos la ${x} por ${txt(xv)} y la ${y} por ${txt(yv)}. ` +
          `Da ${txt(e.c)}, igual que del otro lado. ¡Se cumple! ✔`,
        ...write(`(${i + 1})  ${parts.join(' ')} = ${txt(e.c)}  ✔`, 'muted'),
      })
    })
    return finish(`${x} = ${txt(xv)}, ${y} = ${txt(yv)}`)
  }

  // ---------- Sustitucion: hay una letra sola en alguna ecuacion ----------
  const candidates: Array<[number, string]> = []
  for (const sign of [ONE, neg(ONE)]) {
    s.eqs.forEach((e, i) => [x, y].forEach(v => { if (eq(coefOf(e, v), sign)) candidates.push([i, v]) }))
  }
  if (candidates.length) {
    const [i, u] = candidates[0]
    const w = u === x ? y : x
    const E = s.eqs[i]
    const O = s.eqs[1 - i]
    const j = 2 - i
    const A = coefOf(E, u)
    const B = coefOf(E, w)
    const C = E.c

    steps.push({
      say: `Usamos el método de sustitución. ¿Por qué? Porque en la ecuación (${i + 1}) la ${u} ` +
        `${eq(A, ONE) ? 'está sola, sin ningún número delante' : 'solo tiene un signo menos delante'}: ` +
        `es la más fácil de despejar porque no hay que dividir.`,
      ...write(`Despejamos la ${u} de la ecuación (${i + 1}): no hay que dividir`, 'muted'),
    })
    // A·u + B·w = C  ->  u = p + r·w
    const p = div(C, A)
    const r = div(neg(B), A)
    const expr = exprText(p, r, w)
    if (!isZero(B)) {
      const bw = term(abs(B), w)
      steps.push({
        say: value(B) > 0
          ? `Para dejar la ${u} sola quitamos ${bw} de los dos lados de la ecuación (${i + 1}).`
          : `Para dejar la ${u} sola sumamos ${bw} en los dos lados de la ecuación (${i + 1}).`,
        ...write(`${term(A, u)} = ${exprText(C, neg(B), w)}`, eq(A, ONE) ? 'result' : 'line-text'),
      })
    }
    if (eq(A, neg(ONE))) {
      steps.push({
        say: `La ${u} tiene signo menos. Cambiamos el signo de todo (multiplicamos los dos lados por −1).`,
        ...write(`${u} = ${expr}`, 'result'),
      })
    } else if (isZero(B)) {
      steps.push({ say: `La ecuación (${i + 1}) ya nos dice cuánto vale la ${u}.`, ...write(`${u} = ${expr}`, 'result') })
    }

    const A2 = coefOf(O, u)
    const B2 = coefOf(O, w)
    const C2 = O.c
    let K: Q
    let P: Q
    if (isZero(A2)) {
      steps.push({
        say: `La ecuación (${j}) no tiene ${u}, así que de ahí sacamos la ${w} directamente.`,
        ...write(`(${j})  ${sum([[B2, w]])} = ${txt(C2)}`),
      })
      K = B2
      P = ZERO
    } else {
      const pre = eq(A2, ONE) ? '' : eq(A2, neg(ONE)) ? '−' : txt(A2)
      const rest = isZero(B2) ? '' : ` ${value(B2) < 0 ? '−' : '+'} ${term(abs(B2), w)}`
      steps.push({
        say: `Ahora, en la ecuación (${j}), cambiamos la ${u} por (${expr}), porque valen lo mismo. ` +
          `Así la ecuación (${j}) se queda solo con la ${w} y la podemos resolver.`,
        ...write(`(${j})  ${pre}(${expr})${rest} = ${txt(C2)}`),
      })
      const A2p = mul(A2, p)
      const A2r = mul(A2, r)
      if (!isZero(r)) {
        steps.push({
          say: eq(A2, ONE)
            ? `Quitamos el paréntesis: como no tiene nada delante, todo queda igual.`
            : `Quitamos el paréntesis: el ${txt(A2)} de afuera multiplica a cada cosa de adentro. ` +
              `${txt(A2)} × ${inner(p)} = ${txt(A2p)} y ${txt(A2)} × ${inner(r)}${w} = ${term(A2r, w)}.`,
          ...write(`${sum([[A2p, ''], [A2r, w], [B2, w]])} = ${txt(C2)}`),
        })
      } else {
        steps.push({
          say: `${txt(A2)} × ${inner(p)} = ${txt(A2p)}.`,
          ...write(`${sum([[A2p, ''], [B2, w]])} = ${txt(C2)}`),
        })
      }
      K = add(A2r, B2)
      P = A2p
      if (!isZero(r) && !isZero(B2)) {
        steps.push({
          say: `Juntamos las ${w}: ${term(A2r, w)} y ${term(B2, w)} dan ${isZero(K) ? '0' : term(K, w)}.`,
          ...write(`${sum([[P, ''], [K, w]])} = ${txt(C2)}`),
        })
      }
    }
    if (isZero(K)) return degenerate(P, C2)
    const wv = solveOne(K, w, P, C2)

    // Regresar a la u despejada
    let uv = p
    if (isZero(r)) {
      steps.push({ say: `La ${u} ya la teníamos: ${u} = ${txt(p)}.`, ...write(`${u} = ${txt(p)}`, 'result') })
    } else {
      const t = mul(r, wv)
      uv = add(p, t)
      const one = eq(abs(r), ONE)
      const head = isZero(p) ? (value(r) < 0 ? '−' : '') : `${txt(p)} ${value(r) < 0 ? '−' : '+'} `
      steps.push({
        say: `Ya sabemos que ${w} = ${txt(wv)}. Lo ponemos en ${u} = ${expr} para sacar la ${u}.`,
        ...write(`${u} = ${head}${one ? inner(wv) : `${txt(abs(r))} × ${inner(wv)}`}`),
      })
      if (!isZero(p) && !one) {
        steps.push({
          say: `Primero la multiplicación: ${txt(abs(r))} × ${inner(wv)} = ${txt(abs(t))}.`,
          ...write(`${u} = ${txt(p)} ${value(r) < 0 ? '−' : '+'} ${inner(abs(t))}`),
        })
      }
      steps.push({ say: `Entonces ${u} = ${txt(uv)}.`, ...write(`${u} = ${txt(uv)}`, 'result') })
    }
    return u === x ? check(uv, wv) : check(wv, uv)
  }

  // ---------- Reduccion: igualar el numero de una letra y restar (o sumar) ----------
  const lx = lcm(value(e1.a), value(e2.a)) || Infinity
  const ly = lcm(value(e1.b), value(e2.b)) || Infinity
  const v = ly <= lx ? y : x
  const u = v === x ? y : x
  const k1 = coefOf(e1, v)
  const k2 = coefOf(e2, v)
  const L = Math.min(lx, ly)
  steps.push({
    say: `Ninguna letra está sola, así que usamos el método de reducción: hacemos que la ${v} tenga el mismo número ` +
      `en las dos ecuaciones; así, al restarlas o sumarlas, la ${v} desaparece. Escogemos la ${v} porque sus números ` +
      `(${txt(abs(k1))} y ${txt(abs(k2))}) son los que llegan más fácil a un número igual.`,
    ...write(`Reducción: hacemos que la ${v} tenga el mismo número`, 'muted'),
  })
  const m1 = q(L / Math.abs(value(k1)))
  const m2 = q(L / Math.abs(value(k2)))
  if (!eq(abs(k1), abs(k2))) {
    steps.push({
      say: `¿Qué número está en la tabla del ${txt(abs(k1))} y en la del ${txt(abs(k2))}? El más pequeño es ${L}: ` +
        `${txt(abs(k1))} × ${txt(m1)} = ${L} y ${txt(abs(k2))} × ${txt(m2)} = ${L}.`,
      ...write(`mcm(${txt(abs(k1))}, ${txt(abs(k2))}) = ${L}`, 'muted'),
    })
  }
  const scale = (e: Eq2, m: Q): Eq2 => ({ a: mul(e.a, m), b: mul(e.b, m), c: mul(e.c, m), text: '' })
  const s1 = scale(e1, m1)
  const s2 = scale(e2, m2)
  ;[[1, m1, s1], [2, m2, s2]].forEach(([i, m, se]) => {
    if (eq(m as Q, ONE)) return
    steps.push({
      say: `Multiplicamos toda la ecuación (${i}) por ${txt(m as Q)}: cada número de los dos lados, así sigue en equilibrio.`,
      ...write(`(${i}) × ${txt(m as Q)}:  ${eqText(se as Eq2)}`),
    })
  })
  const sameSign = value(coefOf(s1, v)) === value(coefOf(s2, v))
  // Al restar se resta la que deja la otra letra positiva: (2) − (1) si hace falta
  const flip = sameSign && value(coefOf(s1, u)) < value(coefOf(s2, u))
  const [f, g] = flip ? [s2, s1] : [s1, s2]
  const [fi, gi] = flip ? [2, 1] : [1, 2]
  const K = sameSign ? sub(coefOf(f, u), coefOf(g, u)) : add(coefOf(f, u), coefOf(g, u))
  const R = sameSign ? sub(f.c, g.c) : add(f.c, g.c)
  const op = sameSign ? '−' : '+'
  const lhs = (e: Eq2) => sum([[e.a, x], [e.b, y]])
  steps.push({
    say: sameSign
      ? `Las dos tienen ${term(coefOf(s1, v), v)}, con el mismo signo. Si restamos (${fi}) − (${gi}), la ${v} se va.` +
        (flip ? ` Restamos al revés para que la ${u} quede positiva.` : '')
      : `Una tiene ${term(coefOf(s1, v), v)} y la otra ${term(coefOf(s2, v), v)}: signos distintos. Si las sumamos, la ${v} se va.`,
    ...write(`(${lhs(f)}) ${op} (${lhs(g)}) = ${txt(f.c)} ${op} ${inner(g.c)}`),
  })
  if (isZero(K)) return degenerate(ZERO, R)
  steps.push({
    say: `La ${v} se cancela. Con la ${u}: ${txt(coefOf(f, u))} ${op} ${inner(coefOf(g, u))} = ${txt(K)}. ` +
      `Del otro lado: ${txt(f.c)} ${op} ${inner(g.c)} = ${txt(R)}.`,
    ...write(`${term(K, u)} = ${txt(R)}`, eq(K, ONE) ? 'result' : 'line-text'),
  })
  const uv = solveOne(K, u, ZERO, R)

  // Regresar a una ecuacion original que tenga la v
  const bi = !isZero(coefOf(e1, v)) ? 0 : 1
  const E = s.eqs[bi]
  const cu = coefOf(E, u)
  const cv = coefOf(E, v)
  const known = mul(cu, uv)
  steps.push({
    say: `Ya sabemos que ${u} = ${txt(uv)}. Lo ponemos en la ecuación (${bi + 1}) para sacar la ${v}.`,
    ...write(`(${bi + 1})  ${isZero(cu) ? '' : `${txt(cu)} × ${inner(uv)} ${value(cv) < 0 ? '−' : '+'} `}${isZero(cu) ? term(cv, v) : term(abs(cv), v)} = ${txt(E.c)}`),
  })
  if (!isZero(cu)) {
    steps.push({
      say: `${txt(cu)} × ${inner(uv)} = ${txt(known)}.`,
      ...write(`${sum([[known, ''], [cv, v]])} = ${txt(E.c)}`),
    })
  }
  const vv = solveOne(cv, v, known, E.c)
  return u === x ? check(uv, vv) : check(vv, uv)
}
