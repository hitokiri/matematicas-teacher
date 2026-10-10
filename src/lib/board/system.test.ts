import { describe, it, expect } from 'vitest'
import { parseSystem, systemScript } from './system'
import type { BoardScript } from './types'

const solve = (text: string): BoardScript => {
  const s = parseSystem(text)
  if (!s) throw new Error(`no se reconocio: ${text}`)
  return systemScript(s)
}
const lines = (s: BoardScript) => s.steps.flatMap(st => st.add).map(i => (i.kind === 'text' ? i.text : ''))

describe('sistemas de dos ecuaciones', () => {
  it('x + y = 5 y x − y = 1 por sustitucion, paso a paso', () => {
    const s = solve('x + y = 5\nx - y = 1')
    expect(lines(s)).toEqual([
      '(1)  x + y = 5',
      '(2)  x − y = 1',
      'Despejamos la x de la ecuación (1): no hay que dividir',
      'x = 5 − y',
      '(2)  (5 − y) − y = 1',
      '5 − y − y = 1',
      '5 − 2y = 1',
      '−2y = 1 − 5',
      '−2y = −4',
      'y = −4 ÷ (−2) = 2',
      'x = 5 − 2',
      'x = 3',
      '(1)  3 + 2 = 5  ✔',
      '(2)  3 − 2 = 1  ✔',
      '✔ x = 3, y = 2',
    ])
    expect(s.answer).toBe('x = 3, y = 2')
    expect(s.steps.some(st => st.say.includes('no hay que dividir'))).toBe(true)
  })

  it('por reduccion cuando ninguna letra esta sola', () => {
    const s = solve('2x + 3y = 12; 3x + 2y = 13')
    expect(s.answer).toBe('x = 3, y = 2')
    expect(lines(s)).toContain('mcm(3, 2) = 6')
    expect(lines(s)).toContain('(1) × 2:  4x + 6y = 24')
    expect(lines(s)).toContain('(2) × 3:  9x + 6y = 39')
    expect(s.steps.some(st => st.say.includes('método de reducción'))).toBe(true)
  })

  it('reduccion sumando cuando los signos son distintos', () => {
    const s = solve('2x + 3y = 7, 4x - 3y = 5')
    expect(s.answer).toBe('x = 2, y = 1')
    expect(lines(s)).toContain('(2x + 3y) + (4x − 3y) = 7 + 5')
  })

  it('una ecuacion sin una de las letras', () => {
    expect(solve('x = 3; x + y = 5').answer).toBe('x = 3, y = 2')
    expect(solve('y = 2x\nx + y = 9').answer).toBe('x = 3, y = 6')
  })

  it('resultados en fraccion', () => {
    expect(solve('2x + 4y = 3\nx - y = 0').answer).toBe('x = 1/2, y = 1/2')
  })

  it('sin solucion e infinitas soluciones', () => {
    expect(solve('x + y = 2\nx + y = 5').answer).toBe('No tiene solución')
    expect(solve('x + y = 2\n2x + 2y = 4').answer).toBe('Tiene infinitas soluciones')
    expect(solve('2x + 4y = 2\n3x + 6y = 9').answer).toBe('No tiene solución')
  })

  it('cada pareja respuesta cumple las dos ecuaciones', () => {
    const cases = ['3x - 2y = 4\n5x + 4y = 14', 'a + 2b = 8\n3a - b = 3', '-x + 4y = 7\n2x + y = 4']
    for (const c of cases) {
      const sys = parseSystem(c)!
      const m = systemScript(sys).answer.match(/= (-?[\d/]+), \w = (-?[\d/]+)/)!
      const val = (t: string) => t.split('/').map(Number).reduce((p, d) => p / d)
      const [xv, yv] = [val(m[1].replace('−', '-')), val(m[2].replace('−', '-'))]
      for (const e of sys.eqs) {
        expect(e.a.n / e.a.d * xv + e.b.n / e.b.d * yv).toBeCloseTo(e.c.n / e.c.d)
      }
    }
  })

  it('no reconoce lo que no es un sistema', () => {
    expect(parseSystem('2x + 3y = 6')).toBeNull()
    expect(parseSystem('x + y + z = 1\nx - y = 2')).toBeNull()
    expect(parseSystem('x * y = 6\nx + y = 5')).toBeNull()
    expect(parseSystem('2,5x + y = 3')).toBeNull()
  })
})
