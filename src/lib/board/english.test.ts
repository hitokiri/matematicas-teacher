import { describe, expect, it } from 'vitest'
import { boardFor } from '../../pages/MainApp'
import { TOPICS } from '../capabilities'
import type { BoardScript } from './types'

// Problemas de todos los tipos que la app resuelve sola
const PROBLEMS = [
  ...TOPICS.filter(t => t.support === 'app').flatMap(t => t.examples),
  '10 x 20', '47 + 38', '156 entre 12', '34 x 444', '22-4', '5 - 12', '100 / 0', '7 ÷ 2', '1000 - 1',
  '3 + 4 × 2', '(8 − 3)²', '√50', '√81', '2^10',
  '1/2 + 1/3', '2/3 × 3/5', '6/8', '3/4 ÷ 1/2', '5/0',
  '2x + 4 = 10', '3x + 2 = x + 10', '2(x + 3) = 14', 'x + 1 = x + 2', 'x + 1 = x + 1', '-3x + 2 = 8', 'x/2 = 4', '3x = 1',
  '2x + 3y = 6', 'y = 2x + 1', '3x - 2y = 5',
  'x + y = 5\nx - y = 1', '2x + 3y = 12\n3x + 2y = 13', 'x + y = 2\nx + y = 3', 'x + y = 2\n2x + 2y = 4', 'x = 4\nx + y = 7',
]

/** Todo el texto que ve u oye el nino en un guion */
function texts(script: BoardScript): string[] {
  const out = [script.answer]
  for (const s of script.steps) {
    out.push(s.say)
    for (const item of s.add) {
      if (item.kind !== 'text') continue
      out.push(item.text, ...(item.parts?.map(p => p.text) ?? []))
    }
  }
  return out.filter(Boolean)
}

const SPANISH_CHARS = /[áéíóúñ¿¡]/i
const SPANISH_WORDS = /\b(el|la|los|las|del|con|para|por|que|una|uno|dos|tres|paso|pasos|sumamos|restamos|multiplicamos|dividimos|escribimos|ecuaci[oó]n|resultado|igual|entre|m[aá]s|menos|bolsa|bolsas|balanza|lado|lados|mitad|rebanadas|sobra|sobran|listo|ahora|vamos|cada|ambos|respuesta|comprobamos|soluci[oó]n|infinitas|cualquier|siempre|nunca)\b/i

describe('la pizarra en inglés', () => {
  it.each(PROBLEMS)('no deja español en: %s', problem => {
    const en = boardFor(problem, 'en')
    expect(en, `no se resolvio: ${problem}`).not.toBeNull()
    const allowed = new Set([problem.trim(), problem.replace(/\s*=\s*/g, ' = ').trim()])
    for (const text of texts(en!)) {
      if (allowed.has(text.trim())) continue
      expect(text, `texto con acentos: "${text}"`).not.toMatch(SPANISH_CHARS)
      expect(text, `texto con palabras en español: "${text}"`).not.toMatch(SPANISH_WORDS)
    }
  })

  it.each(PROBLEMS)('el español no cambia: %s', problem => {
    expect(boardFor(problem, 'es')).toEqual(boardFor(problem))
  })

  it('el inglés y el español tienen los mismos pasos', () => {
    for (const problem of PROBLEMS) {
      expect(boardFor(problem, 'en')!.steps.length, problem).toBe(boardFor(problem, 'es')!.steps.length)
    }
  })
})
