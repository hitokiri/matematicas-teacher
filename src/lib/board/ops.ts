// Operaciones que la nena dicta con la voz sobre la ecuacion que esta en la pizarra.
// La regla de la balanza: lo que se hace de un lado se hace del otro.

import type { Q } from './rational'
import { add, div, eq, isZero, mul, q, show, sub } from './rational'
import type { BoardItem, BoardStep, Visual } from './types'
import { pick, type Lang } from './lang'
import { balance, lin, pan, showLin, type Lin } from './equation'

const ZERO = q(0)

/** Estado de la ecuacion en la pizarra: cada lado es una expresion lineal */
export interface EquationState {
  left: Lin
  right: Lin
  variable: string
}

/** Sumar, restar, multiplicar o dividir los dos lados */
export type Operation =
  | { kind: 'add'; amount: Q }
  | { kind: 'sub'; amount: Q }
  | { kind: 'mul'; factor: Q }
  | { kind: 'div'; divisor: Q }

const disp = (a: Q): string => show(a).replace('-', '−')

/** Aplica la operacion a los dos lados y devuelve el nuevo estado con los pasos para la pizarra.
 *  Devuelve null si la operacion no se puede hacer (p. ej. dividir entre 0). */
export function applyOperation(
  e: EquationState,
  op: Operation,
  lang: Lang = 'es',
  startRow = 0,
  idPrefix = 'op',
): { left: Lin; right: Lin; steps: BoardStep[] } | null {
  const T = pick(lang)
  const v = e.variable
  let n = 0
  let row = startRow
  const line = (text: string, tone: 'op' | 'line-text' | 'result' | 'muted' = 'line-text'): BoardItem =>
    ({ id: `${idPrefix}${n++}`, kind: 'text', row: row++, col: 0, text, tone, align: 'start' })
  const write = (text: string, tone: 'op' | 'line-text' | 'result' | 'muted' = 'line-text') => {
    const item = line(text, tone)
    return { add: [item], focus: [[item.row, 0]] as Array<[number, number]> }
  }

  const L = e.left
  const R = e.right

  let left: Lin
  let right: Lin
  let opText: string
  let sayOp: string

  if (op.kind === 'add') {
    const c = op.amount
    left = lin(L.a, add(L.b, c))
    right = lin(R.a, add(R.b, c))
    opText = `${showLin(L, v)} + ${disp(c)} = ${showLin(R, v)} + ${disp(c)}`
    sayOp = T(
      `Sumamos ${disp(c)} a los dos lados de la balanza: sigue en equilibrio.`,
      `We add ${disp(c)} to both sides of the balance scale: it stays level.`,
    )
  } else if (op.kind === 'sub') {
    const c = op.amount
    left = lin(L.a, sub(L.b, c))
    right = lin(R.a, sub(R.b, c))
    opText = `${showLin(L, v)} − ${disp(c)} = ${showLin(R, v)} − ${disp(c)}`
    sayOp = T(
      `Quitamos ${disp(c)} de cada lado de la balanza: sigue en equilibrio.`,
      `We take away ${disp(c)} from each side of the balance scale: it stays level.`,
    )
  } else if (op.kind === 'mul') {
    const f = op.factor
    left = lin(mul(L.a, f), mul(L.b, f))
    right = lin(mul(R.a, f), mul(R.b, f))
    opText = `${showLin(L, v)} × ${disp(f)} = ${showLin(R, v)} × ${disp(f)}`
    sayOp = T(
      `Multiplicamos los dos lados por ${disp(f)}: la balanza sigue en equilibrio.`,
      `We multiply both sides by ${disp(f)}: the balance scale stays level.`,
    )
  } else {
    const d = op.divisor
    if (isZero(d)) return null
    left = lin(div(L.a, d), div(L.b, d))
    right = lin(div(R.a, d), div(R.b, d))
    opText = `${showLin(L, v)} ÷ ${disp(d)} = ${showLin(R, v)} ÷ ${disp(d)}`
    sayOp = T(
      `Dividimos los dos lados entre ${disp(d)}: la balanza sigue en equilibrio.`,
      `We divide both sides by ${disp(d)}: the balance scale stays level.`,
    )
  }

  const eqText = () => `${showLin(left, v)} = ${showLin(right, v)}`
  const visual: Visual = balance(pan(left, v), pan(right, v))

  return {
    left,
    right,
    steps: [
      { say: sayOp, ...write(opText, 'op'), visual },
      { say: T(`Nos queda ${eqText()}.`, `We are left with ${eqText()}.`), ...write(eqText(), 'result'), visual },
    ],
  }
}

/** La ecuacion esta resuelta cuando la incognita queda sola: 1·x + 0 = numero */
export function isSolved(e: EquationState): boolean {
  return eq(e.left.a, q(1)) && isZero(e.left.b)
}

/** La respuesta cuando esta resuelta, o null si no lo esta */
export function answerOf(e: EquationState): string | null {
  return isSolved(e) ? `${e.variable} = ${show(e.right.b)}` : null
}
