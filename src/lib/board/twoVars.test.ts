import { describe, it, expect } from 'vitest'
import { parseTwoVarEquation, twoVarScript } from './twoVars'
import type { BoardScript } from './types'

const solve = (text: string): BoardScript => {
  const e = parseTwoVarEquation(text)
  if (!e) throw new Error(`no se reconocio: ${text}`)
  return twoVarScript(e)
}
const lines = (s: BoardScript) => s.steps.flatMap(st => st.add).map(i => (i.kind === 'text' ? i.text : ''))

describe('ecuaciones con dos incognitas', () => {
  it('2x+3y=6 despeja la y y busca parejas sin saltarse pasos', () => {
    const s = solve('2x+3y=6')
    expect(lines(s)).toEqual([
      '2x+3y = 6',
      '2x + 3y − 2x = 6 − 2x',
      '3y = 6 − 2x',
      'y = (6 − 2x) ÷ 3',
      'Si x = 0:  y = (6 − 2 × 0) ÷ 3',
      'y = (6 − 0) ÷ 3',
      'y = 6 ÷ 3',
      'y = 2',
      '2 × 0 + 3 × 2 = 6  ✔',
      'Si x = 3:  y = (6 − 2 × 3) ÷ 3',
      'y = (6 − 6) ÷ 3',
      'y = 0 ÷ 3',
      'y = 0',
      '2 × 3 + 3 × 0 = 6  ✔',
      '✔ y = (6 − 2x) ÷ 3 (por ejemplo x = 0, y = 2 o x = 3, y = 0)',
    ])
  })

  it('coeficiente negativo en la y: cambia el signo de todo', () => {
    const s = solve('x - y = 4')
    expect(lines(s)).toContain('−y = 4 − x')
    expect(lines(s)).toContain('y = −4 + x')
    expect(s.answer).toContain('x = 0, y = −4')
    expect(s.answer).toContain('x = 4, y = 0')
  })

  it('acomoda las letras de un lado', () => {
    const s = solve('y = 2x + 1')
    expect(lines(s)[1]).toBe('−2x + y = 1')
    expect(s.answer).toContain('y = 1 + 2x')
  })

  it('no reconoce lo que no es una ecuacion lineal con dos letras', () => {
    expect(parseTwoVarEquation('2x + 4 = 10')).toBeNull()
    expect(parseTwoVarEquation('x * y = 6')).toBeNull()
    expect(parseTwoVarEquation('2x + 3y')).toBeNull()
    expect(parseTwoVarEquation('Juan tiene x = 5')).toBeNull()
    expect(parseTwoVarEquation('2x + 3y - 3y = 6')).toBeNull()
  })
})
