import { describe, it, expect } from 'vitest'
import { parseExpression, expressionScript } from './expression'
import type { BoardScript } from './types'

const solve = (text: string): BoardScript => {
  const node = parseExpression(text)
  if (!node) throw new Error(`no se reconocio: ${text}`)
  return expressionScript(node, text)
}

/** Renglones escritos en la pizarra, en orden */
const lines = (s: BoardScript) =>
  s.steps.flatMap(st => st.add).map(i => (i.kind === 'text' ? i.text : ''))

describe('expresiones resueltas por la app', () => {
  it('raiz cubica de 3x4+7: primero lo de adentro y luego la raiz por tanteo', () => {
    const s = solve('raiz cubica de 3x4+7')
    expect(lines(s)[0]).toBe('∛(3 × 4 + 7)')
    expect(lines(s)).toContain('= ∛(12 + 7)')
    expect(lines(s)).toContain('= ∛19')
    // Tanteo con enteros, decimas y centesimas
    expect(lines(s)).toContain('2 × 2 × 2 = 8')
    expect(lines(s)).toContain('3 × 3 × 3 = 27')
    expect(lines(s).some(l => l.startsWith('2.6 × 2.6 × 2.6'))).toBe(true)
    expect(lines(s).some(l => l.startsWith('2.66 × 2.66 × 2.66'))).toBe(true)
    expect(s.answer).toBe('≈ 2.67')
  })

  it('raiz cubica de 7 explica de donde sale 1.91', () => {
    const s = solve('∛7')
    expect(lines(s)).toContain('1 × 1 × 1 = 1')
    expect(lines(s)).toContain('2 × 2 × 2 = 8')
    expect(s.steps.some(st => st.say.includes('está entre 1 y 2'))).toBe(true)
    expect(lines(s).some(l => l.startsWith('1.9 × 1.9 × 1.9') && l.includes('le falta'))).toBe(true)
    expect(lines(s).some(l => l.startsWith('1.91 × 1.91 × 1.91'))).toBe(true)
    expect(s.answer).toBe('≈ 1.91')
  })

  it('raices exactas', () => {
    expect(solve('√49').answer).toBe('7')
    expect(solve('raíz cúbica de 27').answer).toBe('3')
    expect(solve('√2.25').answer).toBe('1.5')
    expect(solve('∛(-8)').answer).toBe('-2')
  })

  it('orden de operaciones y parentesis', () => {
    expect(solve('2 + 3 x 4').answer).toBe('14')
    expect(solve('(2 + 3) x 4').answer).toBe('20')
    expect(solve('8 - 3 + 2').answer).toBe('7')
    expect(solve('3(4+1)').answer).toBe('15')
    expect(solve('2³ + 1').answer).toBe('9')
    expect(solve('5 al cuadrado menos 1').answer).toBe('24')
    expect(solve('√9 + √16').answer).toBe('7')
    expect(solve('10 ÷ 4').answer).toBe('2.5')
    expect(solve('10 entre 3').answer).toBe('≈ 3.333')
  })

  it('narra multiplicaciones antes que sumas', () => {
    const says = solve('3x4+7').steps.map(s => s.say)
    expect(says[1]).toContain('Primero las multiplicaciones y divisiones: 3 × 4 = 12')
    expect(says[2]).toContain('Ahora las sumas y restas: 12 + 7 = 19')
  })

  it('casos sin solucion', () => {
    expect(solve('√(-4)').answer).toBe('No tiene solución')
    expect(solve('5 ÷ (2 - 2)').answer).toBe('No se puede dividir entre 0')
  })

  it('lo que transcriben los modelos de un dibujo', () => {
    // Qwen3-VL 4B
    expect(solve('√(3 × 7 × 6 + 12)').answer).toBe('≈ 11.75')
    // Qwen3.5 2B en LaTeX, con "\\times" convertido en tabulador por el JSON
    expect(solve('\\sqrt{(3 \times 7 \times 6 + 12)}').answer).toBe('≈ 11.75')
    expect(solve('\\sqrt{(3 \\times 7 \\times 6 + 12)}').answer).toBe('≈ 11.75')
  })

  it('raices de cualquier indice', () => {
    const s = solve('raiz quinta de (30)')
    expect(lines(s)[0]).toBe('⁵√30')
    expect(lines(s)).toContain('1 × 1 × 1 × 1 × 1 = 1')
    expect(lines(s)).toContain('2 × 2 × 2 × 2 × 2 = 32')
    expect(s.answer).toBe('≈ 1.97')
    expect(solve('⁵√32').answer).toBe('2')
    expect(solve('\\sqrt[5]{30}').answer).toBe('≈ 1.97')
    expect(solve('raíz 4 de 81').answer).toBe('3')
  })

  it('las fracciones no se convierten en decimales', () => {
    expect(parseExpression('1/2 + 1/4')).toBeNull()
    expect(parseExpression('\\frac{1}{2} + \\frac{1}{4}')).toBeNull()
  })

  it('deja al modelo lo que tiene incognitas o texto', () => {
    expect(parseExpression('2x + 3 = 7')).toBeNull()
    expect(parseExpression('x + 5')).toBeNull()
    expect(parseExpression('Juan tiene 5 manzanas')).toBeNull()
    expect(parseExpression('7')).toBeNull()
    // una x entre signos no se adivina: puede ser un 7 mal leido, se corrige a mano
    expect(parseExpression('√(3 × x × 6 + 12)')).toBeNull()
  })
})
