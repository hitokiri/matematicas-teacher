import { describe, it, expect } from 'vitest'
import { parseEquation, equationScript } from './equation'
import type { BoardScript, Visual } from './types'

const solve = (text: string): BoardScript => {
  const e = parseEquation(text)
  if (!e) throw new Error(`no se reconocio: ${text}`)
  return equationScript(e)
}
const lines = (s: BoardScript) => s.steps.flatMap(st => st.add).map(i => (i.kind === 'text' ? i.text : ''))
const balances = (s: BoardScript) =>
  s.steps.map(st => st.visual).filter((v): v is Extract<Visual, { kind: 'balance' }> => v?.kind === 'balance')

describe('ecuaciones con balanza', () => {
  it('2x + 4 = 10 paso a paso', () => {
    const s = solve('2x+4=10')
    expect(lines(s)).toEqual([
      '2x+4 = 10',
      '2x + 4 − 4 = 10 − 4',
      '2x = 6',
      '2x ÷ 2 = 6 ÷ 2',
      'x = 3',
      '2 × 3 + 4 = 10  ✔',
    ])
    expect(s.answer).toBe('x = 3')
    expect(s.steps.some(st => st.say.includes('Quitamos 4 de cada lado'))).toBe(true)
    expect(s.steps.some(st => st.say.includes('Repartimos 6 en 2 partes iguales: cada bolsa pesa 3'))).toBe(true)
  })

  it('la balanza muestra bolsas y pesas, tacha lo que se quita y reparte en grupos', () => {
    const b = balances(solve('2x+4=10'))
    // Al inicio: 2 bolsas y 4 pesas contra 10 pesas
    expect(b[0].left.filter(i => i.kind === 'x')).toHaveLength(2)
    expect(b[0].left.filter(i => i.kind === 'unit')).toHaveLength(4)
    expect(b[0].right).toHaveLength(10)
    // Quitar 4 de cada lado: 4 tachadas en cada platillo
    expect(b[1].left.filter(i => i.removed)).toHaveLength(4)
    expect(b[1].right.filter(i => i.removed)).toHaveLength(4)
    // Repartir: 2 grupos de 3 pesas
    const groups = b.find(v => v.groups === 2)!
    expect(new Set(groups.right.map(i => i.group))).toEqual(new Set([0, 1]))
    // Final: 1 bolsa contra 3 pesas
    const end = b[b.length - 1]
    expect(end.left).toHaveLength(1)
    expect(end.right).toHaveLength(3)
  })

  it('x en los dos lados', () => {
    const s = solve('3x + 2 = x + 10')
    expect(lines(s)).toContain('3x + 2 − x = x + 10 − x')
    expect(lines(s)).toContain('2x + 2 = 10')
    expect(s.answer).toBe('x = 4')
  })

  it('mas x del lado derecho: voltea la balanza', () => {
    const s = solve('5 = x - 2')
    expect(s.answer).toBe('x = 7')
    expect(s.steps.some(st => st.say.includes('volteamos'))).toBe(true)
    expect(solve('10 = 2x').answer).toBe('x = 5')
    expect(solve('x + 1 = 3x - 5').answer).toBe('x = 3')
  })

  it('resta y parentesis', () => {
    expect(solve('x - 3 = 5').steps.some(st => st.say.includes('Sumamos 3 a los dos lados'))).toBe(true)
    const p = solve('2(x + 3) = 14')
    expect(p.steps[1].say).toContain('quitamos el paréntesis')
    expect(lines(p)).toContain('2x + 6 = 14')
    expect(p.answer).toBe('x = 4')
  })

  it('resultados con fraccion y divisiones', () => {
    expect(solve('2x = 5').answer).toBe('x = 5/2')
    expect(solve('x/2 = 3').answer).toBe('x = 6')
    expect(solve('3x + 1 = 3x + 1').answer).toBe('Cualquier número')
    expect(solve('x + 1 = x + 2').answer).toBe('No tiene solución')
    expect(solve('-x = 4').answer).toBe('x = -4')
  })

  it('otras letras y transcripciones', () => {
    expect(solve('y + 5 = 12').answer).toBe('y = 7')
    expect(solve('3 × x = 15').answer).toBe('x = 5')
  })

  it('no es una ecuacion de primer grado', () => {
    expect(parseEquation('x² = 9')).toBeNull()
    expect(parseEquation('x * x = 9')).toBeNull()
    expect(parseEquation('2 + 2 = 4')).toBeNull()
    expect(parseEquation('Juan tiene x manzanas = 5')).toBeNull()
    expect(parseEquation('2x + 3')).toBeNull()
  })
})
