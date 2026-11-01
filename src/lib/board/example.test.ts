import { describe, it, expect } from 'vitest'
import { exampleFromChat, exampleProblem, splitBoardTag } from './example'
import { boardFor } from '../../pages/MainApp'

const find = (q: string) => exampleProblem(q, t => !!boardFor(t, 'es'))

describe('exampleProblem', () => {
  it('saca el problema de la pregunta', () => {
    expect(find('¿y cómo sería 3/4 + 1/2?')).toBe('3/4 + 1/2')
    expect(find('muéstrame un ejemplo con 2x + 3 = 7')).toBe('2x + 3 = 7')
    expect(find('quiero ver 47 + 38')).toBe('47 + 38')
  })

  it('una duda del paso no es un ejemplo', () => {
    expect(find('¿por qué se resta 4?')).toBeNull()
    expect(find('no entiendo el paso 3')).toBeNull()
    expect(find('explícame mejor')).toBeNull()
  })
})

describe('palabras en vez de simbolos', () => {
  it('entiende "mil 10 entre 20" como 1010 ÷ 20', () => {
    expect(find('y si fuera mil 10 entre 20')).toBe('1010 entre 20')
    expect(find('¿y 5 por 8?')).toBe('5 por 8')
  })
})

describe('exampleFromChat', () => {
  const solvable = (t: string) => !!boardFor(t, 'es')
  const history = [
    { role: 'user' as const, content: 'y si fuera mil 10 entre 20' },
    { role: 'assistant' as const, content: '¡Claro! Aquí va:\nProblema: 1010 ÷ 20 = ?\nPaso 1: ...' },
  ]

  it('"en la pizarra" sin numeros usa el ultimo problema de la conversacion', () => {
    expect(exampleFromChat('Puedes resolver el problema pero en la pizarra.', history, solvable)).toBe('1010 ÷ 20')
  })

  it('sin problema en la conversacion, o sin pedir la pizarra, no hay ejemplo', () => {
    expect(exampleFromChat('Puedes resolver el problema pero en la pizarra.', [], solvable)).toBeNull()
    expect(exampleFromChat('explícame otra vez', history, solvable)).toBeNull()
  })
})

describe('splitBoardTag', () => {
  it('separa la etiqueta del texto', () => {
    expect(splitBoardTag('Se hace así.\n[[PIZARRA: 1010 ÷ 20]]')).toEqual({ text: 'Se hace así.', problem: '1010 ÷ 20' })
  })
  it('sin etiqueta usa el renglón "Problema:" y si no hay nada devuelve null', () => {
    expect(splitBoardTag('Va:\nProblema: 2x + 3 = 7 = ?').problem).toBe('2x + 3 = 7')
    expect(splitBoardTag('Solo texto.').problem).toBeNull()
  })
})
