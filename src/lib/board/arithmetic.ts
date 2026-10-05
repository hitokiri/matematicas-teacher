// Algoritmos de la escuela (suma, resta, multiplicacion y division en columna) convertidos
// en un guion de pizarra paso a paso. Los calcula la app: siempre son correctos.

import type { Arithmetic } from './parse'
import { OP_SYMBOL, placeName } from './parse'
import type { BoardItem, BoardScript, BoardStep, Tone } from './types'

function makeBuilder() {
  let n = 0
  const id = () => `i${n++}`
  return {
    text: (row: number, col: number, text: string, tone: Tone = 'normal', small = false): BoardItem =>
      ({ id: id(), kind: 'text', row, col, text, tone, small }),
    line: (row: number, from: number, to: number): BoardItem => ({ id: id(), kind: 'line', row, from, to }),
    strike: (row: number, col: number): BoardItem => ({ id: id(), kind: 'strike', row, col }),
    bracket: (row: number, col: number, width: number): BoardItem => ({ id: id(), kind: 'bracket', row, col, width }),
  }
}

/** Digito en la posicion `pos` contando desde las unidades, o null si no hay */
function digitAt(n: string, pos: number): number | null {
  const i = n.length - 1 - pos
  return i >= 0 ? Number(n[i]) : null
}

/** Escribe un numero alineado a la derecha terminando en la columna `right` */
function writeNumber(b: ReturnType<typeof makeBuilder>, row: number, right: number, n: string, tone: Tone = 'normal') {
  return [...n].map((d, k) => b.text(row, right - (n.length - 1 - k), d, tone))
}

export function buildArithmetic(p: Arithmetic): BoardScript {
  switch (p.op) {
    case '+': return additionScript(p.numbers)
    case '-': return subtractionScript(p.a, p.b)
    case '*': return multiplicationScript(p.a, p.b)
    case '/': return divisionScript(p.a, p.b)
  }
}

export function additionScript(numbers: string[]): BoardScript {
  const b = makeBuilder()
  const total = numbers.reduce((s, n) => s + BigInt(n), 0n).toString()
  const maxLen = Math.max(...numbers.map(n => n.length))
  const cols = Math.max(total.length, maxLen) + 1 // columna 0: signo
  const R = cols - 1
  const lastRow = numbers.length
  const resultRow = lastRow + 1
  const steps: BoardStep[] = []

  steps.push({
    say: 'Escribimos los números uno debajo del otro, con las unidades bien alineadas a la derecha.',
    add: [
      ...numbers.flatMap((n, i) => writeNumber(b, 1 + i, R, n)),
      b.text(lastRow, 0, OP_SYMBOL['+'], 'op'),
      b.line(lastRow, 0, R),
    ],
  })

  let carry = 0
  for (let j = 0; j < maxLen; j++) {
    const present = numbers
      .map((n, i) => ({ d: digitAt(n, j), row: 1 + i }))
      .filter((x): x is { d: number; row: number } => x.d !== null)
    const sum = present.reduce((s, x) => s + x.d, 0) + carry
    const last = j === maxLen - 1
    const terms = present.map(x => x.d).join(' + ') + (carry ? ` + ${carry} (que llevábamos)` : '')
    const focus: Array<[number, number]> = present.map(x => [x.row, R - j])
    if (carry) focus.push([0, R - j])
    const add: BoardItem[] = []
    let say: string
    if (present.length === 1 && !carry) {
      say = `En las ${placeName(j)} solo está el ${sum}, así que lo bajamos.`
      add.push(b.text(resultRow, R - j, String(sum), 'result'))
    } else if (last) {
      say = `En las ${placeName(j)}: ${terms} = ${sum}. Escribimos ${sum}.`
      add.push(...writeNumber(b, resultRow, R - j, String(sum), 'result'))
    } else {
      const digit = sum % 10
      const next = Math.floor(sum / 10)
      say = `En las ${placeName(j)}: ${terms} = ${sum}. Escribimos el ${digit}` +
        (next ? ` y llevamos ${next} a las ${placeName(j + 1)}.` : '.')
      add.push(b.text(resultRow, R - j, String(digit), 'result'))
      if (next) add.push(b.text(0, R - j - 1, String(next), 'carry', true))
      carry = next
    }
    steps.push({ say, add, focus })
  }

  const expr = numbers.join(' + ')
  steps.push({
    say: `¡Listo! ${expr} = ${total}. 🎉`,
    add: [],
    focus: [...total].map((_, k) => [resultRow, R - k] as [number, number]),
  })
  return { title: `${expr} = ?`, cols, rows: resultRow + 1, steps, answer: total }
}

export function subtractionScript(a: string, b0: string): BoardScript {
  const negative = BigInt(a) < BigInt(b0)
  const [top, bottom] = negative ? [b0, a] : [a, b0]
  const b = makeBuilder()
  const diff = (BigInt(top) - BigInt(bottom)).toString()
  const cols = top.length + 1
  const R = cols - 1
  const steps: BoardStep[] = []

  steps.push({
    say: (negative
      ? `Como ${b0} es mayor que ${a}, restamos ${b0} − ${a} y al final le ponemos el signo menos. `
      : '') + 'Escribimos el número grande arriba y el chico abajo, con las unidades alineadas.',
    add: [...writeNumber(b, 1, R, top), ...writeNumber(b, 2, R, bottom), b.text(2, 0, OP_SYMBOL['-'], 'op'), b.line(2, 0, R)],
  })

  const cur = [...top].reverse().map(Number) // unidades primero
  const noteId: Record<number, string> = {}
  const struck = new Set<number>()
  /** Cambia el valor de la columna j: tacha el digito y escribe el nuevo arriba */
  const change = (j: number, value: number): { add: BoardItem[]; remove: string[] } => {
    const add: BoardItem[] = []
    const remove: string[] = []
    if (!struck.has(j)) {
      add.push(b.strike(1, R - j))
      struck.add(j)
    }
    if (noteId[j]) remove.push(noteId[j])
    const note = b.text(0, R - j, String(value), 'carry', true)
    noteId[j] = note.id
    add.push(note)
    cur[j] = value
    return { add, remove }
  }

  for (let j = 0; j < top.length; j++) {
    const d = digitAt(bottom, j)
    if (d !== null && cur[j] < d) {
      let k = j + 1
      while (cur[k] === 0) k++
      const lender = cur[k]
      const t = cur[j]
      const changes = [change(k, lender - 1)]
      for (let z = j + 1; z < k; z++) changes.push(change(z, 9))
      changes.push(change(j, t + 10))
      steps.push({
        say: k === j + 1
          ? `No podemos quitarle ${d} a ${t}. Le pedimos prestado 1 a las ${placeName(k)}: el ${lender} se vuelve ${lender - 1} y el ${t} se vuelve ${t + 10}.`
          : `No podemos quitarle ${d} a ${t}, y en las ${placeName(j + 1)} hay un 0. Pedimos prestado a las ${placeName(k)}: el ${lender} se vuelve ${lender - 1}, los ceros se vuelven 9 y el ${t} se vuelve ${t + 10}.`,
        add: changes.flatMap(c => c.add),
        remove: changes.flatMap(c => c.remove),
        focus: [[1, R - j], [1, R - k]],
      })
    }
    const t = cur[j]
    const r = t - (d ?? 0)
    const focus: Array<[number, number]> = [[1, R - j]]
    if (d !== null) focus.push([2, R - j])
    const leadingZero = r === 0 && j > 0 && j >= diff.length
    let say: string
    const add: BoardItem[] = []
    if (leadingZero) {
      say = `En las ${placeName(j)}: ${t} − ${d ?? 0} = 0. Un cero a la izquierda no se escribe.`
    } else if (d === null) {
      say = `En las ${placeName(j)} solo queda el ${t}, así que lo bajamos.`
      add.push(b.text(3, R - j, String(r), 'result'))
    } else {
      say = `En las ${placeName(j)}: ${t} − ${d} = ${r}. Escribimos ${r}.`
      add.push(b.text(3, R - j, String(r), 'result'))
    }
    steps.push({ say, add, focus })
  }

  const answer = negative ? `-${diff}` : diff
  const finalAdd: BoardItem[] = negative ? [b.text(3, R - diff.length, '−', 'result')] : []
  steps.push({
    say: `¡Listo! ${a} − ${b0} = ${answer}. 🎉`,
    add: finalAdd,
    focus: [...diff].map((_, k) => [3, R - k] as [number, number]),
  })
  return { title: `${a} − ${b0} = ?`, cols, rows: 4, steps, answer }
}

export function multiplicationScript(a: string, b0: string): BoardScript {
  // Arriba va el numero mas largo (menos filas que sumar)
  const swap = b0.length > a.length
  const [top, bottom] = swap ? [b0, a] : [a, b0]
  const b = makeBuilder()
  const product = (BigInt(top) * BigInt(bottom)).toString()
  const m = bottom.length
  const partialLen = (j: number) => {
    const bd = digitAt(bottom, j)!
    return bd === 0 ? top.length : (BigInt(top) * BigInt(bd)).toString().length
  }
  const width = Math.max(top.length, bottom.length + 1, product.length,
    ...Array.from({ length: m }, (_, j) => j + partialLen(j)))
  const cols = width + 1
  const R = cols - 1
  const single = m === 1
  const sumCarryRow = 3
  const partialRow = (j: number) => (single ? 3 : 4 + j)
  const finalRow = single ? 3 : 4 + m
  const steps: BoardStep[] = []

  steps.push({
    say: (swap ? `Ponemos arriba el ${top}, que es el número más largo. ` : '') +
      `Escribimos ${top} arriba y ${bottom} abajo, con las unidades alineadas.`,
    add: [...writeNumber(b, 1, R, top), ...writeNumber(b, 2, R, bottom), b.text(2, 0, OP_SYMBOL['*'], 'op'), b.line(2, 0, R)],
  })

  /** digitos escritos en las filas de productos parciales: fila -> columna -> digito */
  const grid: Record<number, Record<number, number>> = {}
  const put = (row: number, col: number, d: number, tone: Tone) => {
    ;(grid[row] ??= {})[col] = d
    return b.text(row, col, String(d), tone)
  }
  let carryIds: string[] = []

  for (let j = 0; j < m; j++) {
    const bd = digitAt(bottom, j)!
    const row = partialRow(j)
    const tone: Tone = single ? 'result' : 'normal'
    if (!single) {
      steps.push({
        say: j === 0
          ? `Primero multiplicamos ${top} por el ${bd} de las unidades.`
          : `Ahora multiplicamos ${top} por el ${bd} de las ${placeName(j)}. Como es de las ${placeName(j)}, empezamos a escribir ${j === 1 ? 'un lugar' : `${j} lugares`} más a la izquierda.`,
        add: [],
        remove: carryIds,
        focus: [[2, R - j]],
      })
      carryIds = []
    }
    if (bd === 0) {
      steps.push({
        say: `Cualquier número por 0 da 0, así que esta fila es toda de ceros.`,
        add: [...top].map((_, i) => put(row, R - j - i, 0, tone)),
        focus: [[2, R - j]],
      })
      continue
    }
    let carry = 0
    for (let i = 0; i < top.length; i++) {
      const td = digitAt(top, i)!
      const prod = bd * td
      const p = prod + carry
      const last = i === top.length - 1
      const add: BoardItem[] = []
      const focus: Array<[number, number]> = [[2, R - j], [1, R - i]]
      if (carry) focus.push([0, R - i])
      let say = `${bd} × ${td} = ${prod}` + (carry ? `, más ${carry} que llevábamos, son ${p}` : '')
      if (last) {
        add.push(put(row, R - j - i, p % 10, tone))
        if (p >= 10) add.push(put(row, R - j - i - 1, Math.floor(p / 10), tone))
        say += `. Escribimos ${p}.`
        carry = 0
      } else {
        const next = Math.floor(p / 10)
        add.push(put(row, R - j - i, p % 10, tone))
        if (next) {
          const c = b.text(0, R - i - 1, String(next), 'carry', true)
          carryIds.push(c.id)
          add.push(c)
          say += `. Escribimos el ${p % 10} y llevamos ${next}.`
        } else {
          say += `. Escribimos ${p % 10}.`
        }
        carry = next
      }
      steps.push({ say, add, focus })
    }
  }

  if (!single) {
    const lastPartial = partialRow(m - 1)
    steps.push({
      say: 'Ahora sumamos los resultados de cada fila, columna por columna.',
      add: [b.text(lastPartial, 0, OP_SYMBOL['+'], 'op'), b.line(lastPartial, 0, R)],
      remove: carryIds,
    })
    const rowsUsed = Array.from({ length: m }, (_, j) => partialRow(j))
    const leftmost = Math.min(...rowsUsed.flatMap(r => Object.keys(grid[r] ?? {}).map(Number)))
    let carry = 0
    for (let col = R; col >= leftmost; col--) {
      const present = rowsUsed
        .filter(r => grid[r]?.[col] !== undefined)
        .map(r => ({ d: grid[r][col], row: r }))
      const sum = present.reduce((s, x) => s + x.d, 0) + carry
      const place = placeName(R - col)
      const terms = present.map(x => x.d).join(' + ') + (carry ? ` + ${carry} (que llevábamos)` : '')
      const focus: Array<[number, number]> = present.map(x => [x.row, col])
      const add: BoardItem[] = []
      let say: string
      if (col === leftmost) {
        say = `En las ${place}: ${terms} = ${sum}. Escribimos ${sum}.`
        add.push(...writeNumber(b, finalRow, col, String(sum), 'result'))
      } else if (present.length === 1 && !carry) {
        say = `En las ${place} solo está el ${sum}, lo bajamos.`
        add.push(b.text(finalRow, col, String(sum), 'result'))
      } else {
        const next = Math.floor(sum / 10)
        say = `En las ${place}: ${terms} = ${sum}. Escribimos el ${sum % 10}` + (next ? ` y llevamos ${next}.` : '.')
        add.push(b.text(finalRow, col, String(sum % 10), 'result'))
        if (next) add.push(b.text(sumCarryRow, col - 1, String(next), 'carry', true))
        carry = next
      }
      steps.push({ say, add, focus })
    }
  }

  steps.push({
    say: `¡Listo! ${a} × ${b0} = ${product}. 🎉`,
    add: [],
    focus: [...product].map((_, k) => [finalRow, R - k] as [number, number]),
  })
  return { title: `${a} × ${b0} = ?`, cols, rows: finalRow + 1, steps, answer: product }
}

export function divisionScript(a: string, d: string): BoardScript {
  const b = makeBuilder()
  if (BigInt(d) === 0n) {
    return {
      title: `${a} ÷ 0 = ?`,
      cols: a.length + 4,
      rows: 1,
      steps: [{
        say: 'No se puede dividir entre 0: no hay forma de repartir algo en 0 grupos.',
        add: [{ id: 'z', kind: 'text', row: 0, col: 0, text: `${a} ÷ 0 = ✗`, tone: 'op', align: 'start' }],
      }],
      answer: 'No se puede dividir entre 0',
    }
  }
  const divisor = BigInt(d)
  const L = d.length
  const D = L + 1 // primera columna del dividendo (la columna L es el hueco de la casita)
  const cols = D + a.length
  const steps: BoardStep[] = []
  const dividendCells = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, k) => [1, from + k] as [number, number])

  steps.push({
    say: `Escribimos ${a} dentro de la casita y el ${d} afuera, a la izquierda.`,
    add: [...writeNumber(b, 1, L - 1, d), ...writeNumber(b, 1, cols - 1, a), b.bracket(1, D, a.length)],
  })

  let k = 1
  while (k < a.length && BigInt(a.slice(0, k)) < divisor) k++
  let cur = BigInt(a.slice(0, k))
  let end = D + k - 1
  let curRow = 1
  let quotient = ''
  let rem = 0n
  let first = true

  for (;;) {
    const qd = cur / divisor
    const prod = qd * divisor
    rem = cur - prod
    quotient += qd.toString()
    const curLen = cur.toString().length
    const intro = first && k > 1 ? `Como ${a.slice(0, k - 1)} es menor que ${d}, tomamos ${cur}. ` : ''
    first = false
    steps.push({
      say: intro + (qd === 0n
        ? `El ${d} no cabe en ${cur}, así que escribimos 0 arriba.`
        : `¿Cuántas veces cabe ${d} en ${cur}? ${qd} veces, porque ${d} × ${qd} = ${prod}. Escribimos ${qd} arriba.`),
      add: [b.text(0, end, qd.toString(), 'result')],
      focus: curRow === 1 ? dividendCells(end - curLen + 1, end) : Array.from({ length: curLen }, (_, i) => [curRow, end - i] as [number, number]),
    })
    const prodRow = curRow + 1
    const remRow = prodRow + 1
    const prodStr = prod.toString()
    steps.push({
      say: `Multiplicamos ${d} × ${qd} = ${prod}, lo escribimos debajo y restamos: ${cur} − ${prod} = ${rem}.`,
      add: [
        ...writeNumber(b, prodRow, end, prodStr, 'muted'),
        b.text(prodRow, end - prodStr.length, OP_SYMBOL['-'], 'op'),
        b.line(prodRow, end - curLen + 1, end),
        ...writeNumber(b, remRow, end, rem.toString()),
      ],
      focus: [[remRow, end]],
    })
    curRow = remRow
    if (end - D + 1 >= a.length) break
    const next = a[end - D + 1]
    cur = rem * 10n + BigInt(next)
    end += 1
    steps.push({
      say: `Bajamos el ${next}: ahora tenemos ${cur}.`,
      add: [b.text(remRow, end, next, 'normal')],
      focus: [[1, end], [remRow, end]],
    })
  }

  const q = BigInt(quotient).toString()
  const answer = rem === 0n ? q : `${q} y sobran ${rem}`
  steps.push({
    say: rem === 0n
      ? `¡Listo! ${a} ÷ ${d} = ${q}. No sobra nada. 🎉`
      : `¡Listo! ${a} ÷ ${d} = ${q} y sobran ${rem}. Ese ${rem} es el residuo. 🎉`,
    add: [],
    focus: [...quotient].map((_, i) => [0, end - i] as [number, number]),
  })
  return { title: `${a} ÷ ${d} = ?`, cols, rows: curRow + 1, steps, answer }
}
