// Intencion por voz: transcript -> Operation.
// Primero el camino determinista (regex de frases comunes); el LLM local se agrega encima
// y usa esto como respaldo. Si nada se reconoce, la maestra pregunta en vez de ejecutar.

import { q, type Q } from './rational'
import type { Lang } from './lang'
import type { Operation } from './ops'

const WORDS_ES: Record<string, number> = {
  uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
}
const WORDS_EN: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/[−–—]/g, '-')

const numPattern = (lang: Lang): string => {
  const words = Object.keys(lang === 'en' ? WORDS_EN : WORDS_ES).join('|')
  return `(-?\\d+(?:\\.\\d+)?|${words})`
}

const toQ = (m: string, lang: Lang): Q | null => {
  if (/^-?\d+(\.\d+)?$/.test(m)) return q(Number(m))
  const w = (lang === 'en' ? WORDS_EN : WORDS_ES)[m]
  return w ? q(w) : null
}

/** Reconoce una operacion dictada; null si la frase no se entiende */
export function parseOperationIntent(transcript: string, lang: Lang = 'es'): Operation | null {
  const s = normalize(transcript)
  if (!s) return null
  const NUM = numPattern(lang)

  const patterns: Array<[RegExp, Operation['kind']]> = lang === 'en'
    ? [
        [new RegExp(`(?:add|sum)\\s+${NUM}`), 'add'],
        [new RegExp(`(?:subtract|take away|minus)\\s+${NUM}`), 'sub'],
        [new RegExp(`(?:multiply|multiplies)\\s+(?:by\\s+)?${NUM}`), 'mul'],
        [new RegExp(`(?:divide|divides)\\s+(?:by|into)\\s+${NUM}`), 'div'],
      ]
    : [
        [new RegExp(`(?:sumar|suma|sumo|agregar|agrega|agrego|anadir|anade|poner|pone|ponga)\\s+${NUM}`), 'add'],
        [new RegExp(`(?:restar|resta|resto|quitar|quita|quito|sacar|saca|saco)\\s+${NUM}`), 'sub'],
        [new RegExp(`(?:multiplicar|multiplica|multiplico|multipliquemos)\\s+(?:por\\s+)?${NUM}`), 'mul'],
        [new RegExp(`(?:dividir|divide|dividimos|divida)\\s+(?:por|entre)\\s+${NUM}`), 'div'],
      ]

  for (const [re, kind] of patterns) {
    const m = s.match(re)
    if (!m) continue
    const amount = toQ(m[1], lang)
    if (!amount) continue
    if (kind === 'add') return { kind, amount }
    if (kind === 'sub') return { kind, amount }
    if (kind === 'mul') return { kind, factor: amount }
    return { kind, divisor: amount }
  }
  return null
}
