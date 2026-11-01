import { describe, it, expect } from 'vitest'
import { parseOperationIntent } from './intent'
import { q } from './rational'

describe('intencion por voz (determinista)', () => {
  it('frases comunes en espanol', () => {
    expect(parseOperationIntent('sumar 3 a los dos lados')).toEqual({ kind: 'add', amount: q(3) })
    expect(parseOperationIntent('podemos restar 4')).toEqual({ kind: 'sub', amount: q(4) })
    expect(parseOperationIntent('multiplicar por 2')).toEqual({ kind: 'mul', factor: q(2) })
    expect(parseOperationIntent('dividir entre 4')).toEqual({ kind: 'div', divisor: q(4) })
    expect(parseOperationIntent('quitar 5 de cada lado')).toEqual({ kind: 'sub', amount: q(5) })
  })

  it('numeros en palabras', () => {
    expect(parseOperationIntent('sumar tres')).toEqual({ kind: 'add', amount: q(3) })
    expect(parseOperationIntent('divide by four', 'en')).toEqual({ kind: 'div', divisor: q(4) })
  })

  it('frases en ingles', () => {
    expect(parseOperationIntent('add 3 to both sides', 'en')).toEqual({ kind: 'add', amount: q(3) })
    expect(parseOperationIntent('take away 2', 'en')).toEqual({ kind: 'sub', amount: q(2) })
    expect(parseOperationIntent('multiply by 2', 'en')).toEqual({ kind: 'mul', factor: q(2) })
  })

  it('si no se entiende la operacion, devuelve null (la maestra pregunta)', () => {
    expect(parseOperationIntent('¿qué hacemos ahora?')).toBeNull()
    expect(parseOperationIntent('no sé')).toBeNull()
    expect(parseOperationIntent('')).toBeNull()
  })
})
