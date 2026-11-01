import { describe, it, expect } from 'vitest'
import { parseEquation } from './equation'
import { applyOperation, isSolved, answerOf } from './ops'
import { q } from './rational'
import type { BoardStep, Visual } from './types'

const state = (text: string) => {
  const e = parseEquation(text)
  if (!e) throw new Error(`no se reconocio: ${text}`)
  return { left: e.left, right: e.right, variable: e.variable }
}
const lines = (steps: BoardStep[]) => steps.flatMap(st => st.add).map(i => (i.kind === 'text' ? i.text : ''))
const balances = (steps: BoardStep[]) =>
  steps.map(st => st.visual).filter((v): v is Extract<Visual, { kind: 'balance' }> => v?.kind === 'balance')

describe('operaciones dictadas por voz (balanza)', () => {
  it('restar 4 de los dos lados de 2x + 4 = 10', () => {
    const r = applyOperation(state('2x+4=10'), { kind: 'sub', amount: q(4) })
    expect(r).not.toBeNull()
    expect(lines(r!.steps)).toEqual(['2x + 4 − 4 = 10 − 4', '2x = 6'])
    expect(r!.steps[0].say).toContain('Quitamos 4 de cada lado')
    expect(r!.left).toEqual({ a: q(2), b: q(0) })
    expect(r!.right).toEqual({ a: q(0), b: q(6) })
  })

  it('sumar 3 a los dos lados', () => {
    const r = applyOperation(state('x+1=5'), { kind: 'add', amount: q(3) })
    expect(lines(r!.steps)).toEqual(['x + 1 + 3 = 5 + 3', 'x + 4 = 8'])
    expect(r!.steps[0].say).toContain('Sumamos 3 a los dos lados')
  })

  it('multiplicar por 2 los dos lados', () => {
    const r = applyOperation(state('2x=6'), { kind: 'mul', factor: q(2) })
    expect(lines(r!.steps)).toEqual(['2x × 2 = 6 × 2', '4x = 12'])
    expect(r!.steps[0].say).toContain('Multiplicamos los dos lados por 2')
  })

  it('dividir entre 2 deja la x sola y la ecuacion queda resuelta', () => {
    const r = applyOperation(state('2x=6'), { kind: 'div', divisor: q(2) })
    expect(lines(r!.steps)).toEqual(['2x ÷ 2 = 6 ÷ 2', 'x = 3'])
    expect(isSolved(r!.left && { left: r!.left, right: r!.right, variable: 'x' })).toBe(true)
    expect(answerOf({ left: r!.left, right: r!.right, variable: 'x' })).toBe('x = 3')
  })

  it('no se puede dividir entre 0', () => {
    expect(applyOperation(state('2x=6'), { kind: 'div', divisor: q(0) })).toBeNull()
  })

  it('la balanza muestra el estado nuevo en cada paso', () => {
    const r = applyOperation(state('2x+4=10'), { kind: 'sub', amount: q(4) })
    const b = balances(r!.steps)
    expect(b).toHaveLength(2)
    // Despues de quitar 4: 2 bolsas contra 6 pesas
    expect(b[0].left.filter(i => i.kind === 'x')).toHaveLength(2)
    expect(b[0].left.filter(i => i.kind === 'unit')).toHaveLength(0)
    expect(b[0].right).toHaveLength(6)
  })

  it('los pasos se escriben en filas consecutivas desde la fila indicada', () => {
    const r = applyOperation(state('x+1=5'), { kind: 'add', amount: q(3) }, 'es', 5)
    const rows = r!.steps.flatMap(st => st.add).map(i => (i.kind === 'text' ? i.row : -1))
    expect(rows).toEqual([5, 6])
    expect(r!.steps[0].focus).toEqual([[5, 0]])
  })
})

describe('ids de los trazos entre operaciones', () => {
  it('con prefijos distintos las operaciones no se pisan en la pizarra', () => {
    const a = applyOperation(state('2x = 8'), { kind: 'add', amount: q(1) }, 'es', 1, 'op1_')!
    const b = applyOperation({ left: a.left, right: a.right, variable: 'x' }, { kind: 'mul', factor: q(2) }, 'es', 3, 'op3_')!
    const ids = [...a.steps, ...b.steps].flatMap(s => s.add.map(i => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
