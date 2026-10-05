import { describe, it, expect } from 'vitest'
import { parseFractions, fractionScript } from './fraction'
import { parseArithmetic } from './parse'
import type { BoardScript, Visual } from './types'

const solve = (text: string): BoardScript => {
  const p = parseFractions(text)
  if (!p) throw new Error(`no se reconocio: ${text}`)
  return fractionScript(p)
}
const lines = (s: BoardScript) => s.steps.flatMap(st => st.add).map(i => (i.kind === 'text' ? i.text : ''))
type PizzasV = Extract<Visual, { kind: 'pizzas' }>
const pizzaVisuals = (s: BoardScript) => s.steps.map(st => st.visual).filter((v): v is PizzasV => v?.kind === 'pizzas')

describe('fracciones con pizzas', () => {
  it('1/2 + 1/4: recortar las rebanadas al mismo tamano y juntar', () => {
    const s = solve('1/2 + 1/4')
    expect(lines(s)).toEqual([
      '1/2 + 1/4',
      'Tabla del 2: 2, 4   ·   Tabla del 4: 4',
      '1/2 = (1 × 2)/(2 × 2) = 2/4',
      '2/4 + 1/4 = 3/4',
    ])
    expect(s.answer).toBe('3/4')
    const v = pizzaVisuals(s)
    // Inicio: pizza de 2 rebanadas con 1 tomada y pizza de 4 con 1
    expect(v[0].terms.map(t => t.pizzas[0])).toMatchObject([{ slices: 2, filled: 1 }, { slices: 4, filled: 1 }])
    // Resultado: 4 rebanadas, 3 tomadas, 1 de la segunda fraccion (otro color)
    const last = v[v.length - 1]
    expect(last.terms[2].pizzas[0]).toMatchObject({ slices: 4, filled: 3, second: 1 })
  })

  it('mismo denominador y simplificar', () => {
    const s = solve('1/8 + 5/8')
    expect(lines(s)).toContain('1/8 + 5/8 = 6/8')
    expect(lines(s)).toContain('6/8 = (6 ÷ 2)/(8 ÷ 2) = 3/4')
    expect(s.answer).toBe('3/4')
  })

  it('mas de una pizza', () => {
    const s = solve('3/4 + 3/4')
    expect(s.answer).toBe('3/2 = 1 y 1/2')
  })

  it('resta tacha las rebanadas que se quitan', () => {
    const s = solve('3/4 - 1/3')
    expect(s.answer).toBe('5/12')
    const v = pizzaVisuals(s)
    expect(v[v.length - 1].terms[0].pizzas[0]).toMatchObject({ slices: 12, filled: 9, removed: 4 })
  })

  it('multiplicar con el rectangulo', () => {
    const s = solve('2/3 x 3/5')
    const grids = s.steps.map(st => st.visual).filter(v => v?.kind === 'grid')
    expect(grids[grids.length - 1]).toEqual({ kind: 'grid', rows: 3, cols: 5, rowsFilled: 2, colsFilled: 3 })
    expect(lines(s)).toContain('2/3 × 3/5 = (2 × 3)/(3 × 5) = 6/15')
    expect(s.answer).toBe('2/5')
  })

  it('entero por fraccion es sumar varias veces', () => {
    const s = solve('3 × 1/4')
    expect(lines(s)).toContain('3 × 1/4 = 1/4 + 1/4 + 1/4 = 3/4')
    expect(s.answer).toBe('3/4')
  })

  it('dividir fracciones', () => {
    const s = solve('1/2 ÷ 1/4')
    expect(s.steps.some(st => st.say.includes('¿Cuántas veces cabe 1/4 en 1/2? ¡2 veces!'))).toBe(true)
    expect(s.answer).toBe('2')
    expect(solve('3/4 entre 2/3').answer).toBe('9/8 = 1 y 1/8')
  })

  it('simplificar una fraccion sola', () => {
    expect(solve('6/8').answer).toBe('3/4')
    expect(solve('\\frac{6}{8}').answer).toBe('3/4')
    expect(solve('\\frac{1}{2} + \\frac{1}{4}').answer).toBe('3/4')
  })

  it('varias fracciones y un entero: 1/2 + 1/4 + 10', () => {
    const s = solve('1/2+1/4+10')
    expect(lines(s)).toEqual([
      '1/2 + 1/4 + 10',
      '1/2 + 1/4',
      'Tabla del 2: 2, 4   ·   Tabla del 4: 4',
      '1/2 = (1 × 2)/(2 × 2) = 2/4',
      '2/4 + 1/4 = 3/4',
      '= 3/4 + 10',
      '10 = (10 × 4)/4 = 40/4',
      '3/4 + 40/4 = 43/4',
      '43/4 = 10 y 3/4',
    ])
    expect(s.answer).toBe('43/4 = 10 y 3/4')
    expect(s.steps.some(st => st.say.includes('cortamos cada pizza en 4 rebanadas: 10 × 4 = 40'))).toBe(true)
    expect(s.steps[s.steps.length - 1].say).toContain('En decimales es 10.75')
  })

  it('orden de operaciones con fracciones', () => {
    const s = solve('1/2 + 2 × 3/4')
    expect(s.steps[0].say).toContain('primero multiplicaciones y divisiones')
    // primero 2 × 3/4 = 6/4 = 3/2, despues 1/2 + 3/2 = 4/2 = 2
    expect(lines(s)).toContain('2 × 3/4')
    expect(lines(s)).toContain('= 1/2 + 3/2')
    expect(s.answer).toBe('2')
  })

  it('no es un problema de fracciones', () => {
    expect(parseFractions('3/4')).toBeNull() // ya esta simplificada, no hay nada que hacer
    expect(parseFractions('6 ÷ 3')).toBeNull()
    expect(parseFractions('x/2 = 3')).toBeNull()
    // "1/2" sola tampoco es una division en casita
    expect(parseArithmetic('1/2')).toBeNull()
  })
})
