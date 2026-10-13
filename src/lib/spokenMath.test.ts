import { describe, expect, it } from 'vitest'
import { numberToWords, spokenMath } from './spokenMath'

describe('numberToWords', () => {
  it.each([
    [0, 'cero'], [1, 'uno'], [16, 'dieciséis'], [21, 'veintiuno'], [30, 'treinta'], [45, 'cuarenta y cinco'],
    [100, 'cien'], [101, 'ciento uno'], [999, 'novecientos noventa y nueve'], [1000, 'mil'],
    [2024, 'dos mil veinticuatro'], [21000, 'veintiún mil'], [31000, 'treinta y un mil'],
    [1000000, 'un millón'], [2500000, 'dos millones quinientos mil'],
  ])('%i', (n, words) => expect(numberToWords(n)).toBe(words))
})

describe('spokenMath', () => {
  it('lee ecuaciones con letras', () => {
    expect(spokenMath('2x + 3y = 6')).toBe('dos equis más tres ye igual a seis')
    expect(spokenMath('x = −3')).toBe('equis igual a menos tres')
  })
  it('distingue la letra y de la conjuncion', () => {
    expect(spokenMath('la x y la y')).toBe('la equis y la ye')
    expect(spokenMath('sumamos y restamos')).toBe('sumamos y restamos')
  })
  it('lee operaciones', () => {
    expect(spokenMath('3 × 4 = 12')).toBe('tres por cuatro igual a doce')
    expect(spokenMath('3 x 4')).toBe('tres por cuatro')
    expect(spokenMath('156 ÷ 12')).toBe('ciento cincuenta y seis entre doce')
    expect(spokenMath('5 − 3')).toBe('cinco menos tres')
  })
  it('lee fracciones, potencias y raices', () => {
    expect(spokenMath('1/2')).toBe('un medio')
    expect(spokenMath('3/4 + 1/4')).toBe('tres cuartos más un cuarto')
    expect(spokenMath('3/12')).toBe('tres entre doce')
    expect(spokenMath('x²')).toBe('equis al cuadrado')
    expect(spokenMath('2^5')).toBe('dos elevado a cinco')
    expect(spokenMath('√50')).toBe('raíz cuadrada de cincuenta')
  })
  it('lee decimales y porcentajes', () => {
    expect(spokenMath('3.5')).toBe('tres punto cinco')
    expect(spokenMath('20%')).toBe('veinte por ciento')
  })
  it('quita emojis y parentesis', () => {
    expect(spokenMath('¡Listo! 🎉')).toBe('¡Listo!')
    expect(spokenMath('ecuación (1)')).toBe('ecuación, uno,')
  })
})
