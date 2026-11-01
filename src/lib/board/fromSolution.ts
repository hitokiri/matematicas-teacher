// Convierte la explicacion del modelo (pasos con titulo, explicacion y operacion) en un guion
// de pizarra: cada paso escribe su operacion en un renglon nuevo.

import type { BoardItem, BoardScript, BoardStep } from './types'
import { pick, type Lang } from './lang'

export interface SolutionLike {
  problem: string
  steps: Array<{ step: number; explanation: string; title?: string | null; calculation?: string | null }>
  final_answer: string
}

/** Caracteres aproximados que caben en una columna de la cuadricula */
const CHARS_PER_COL = 1.6

export function solutionScript(solution: SolutionLike, lang: Lang = 'es'): BoardScript {
  const T = pick(lang)
  let n = 0
  const line = (row: number, text: string, tone: 'op' | 'line-text' | 'result'): BoardItem =>
    ({ id: `s${n++}`, kind: 'text', row, col: 0, text, tone, align: 'start' })

  const answer = cleanAnswer(solution.final_answer)
  const steps: BoardStep[] = [{
    say: T('Este es el problema. ¡Vamos a resolverlo paso a paso!', "This is the problem. Let's solve it step by step!"),
    add: [line(0, solution.problem, 'op')],
  }]
  let row = 1
  const written = [norm(solution.problem)]
  const seen = new Set<string>()
  for (const s of solution.steps) {
    // Un paso que el modelo repite tal cual no se vuelve a explicar
    const key = norm(`${s.calculation ?? ''}|${s.explanation}`)
    if (seen.has(key)) continue
    seen.add(key)
    const title = s.title?.trim()
    const calc = s.calculation?.trim()
    // Lo que se escribe: la operacion; si repite lo de arriba, el titulo; si no, la explicacion corta
    const options = [calc, title, shorten(s.explanation)].filter((t): t is string => !!t)
    const text = options.find(t => norm(t) !== written[written.length - 1]) ?? options[0] ?? '…'
    written.push(norm(text))
    steps.push({
      say: narration(title, s.explanation),
      add: [line(row, text, 'line-text')],
      focus: [[row, 0]],
    })
    row++
  }
  steps.push({ say: T(`¡Listo! La respuesta es ${answer}. 🎉`, `Done! The answer is ${answer}. 🎉`), add: [line(row, `✔ ${answer}`, 'result')] })

  const longest = Math.max(
    ...steps.flatMap(s => s.add).map(i => (i.kind === 'text' ? i.text.length : 0)),
    10,
  )
  return {
    title: solution.problem,
    cols: Math.ceil(longest / CHARS_PER_COL) + 1,
    rows: row + 1,
    steps,
    answer,
  }
}

/** Lo que dice la maestra: titulo y explicacion sin decir dos veces lo mismo */
export function narration(title: string | undefined, explanation: string): string {
  const sentences = explanation.split(/(?<=[.!?])\s+/).map(t => t.trim()).filter(Boolean)
  const kept: string[] = []
  const said = new Set<string>()
  for (const sentence of sentences) {
    const key = words(sentence).join(' ')
    if (key && said.has(key)) continue
    said.add(key)
    kept.push(sentence)
  }
  const body = kept.join(' ')
  if (!title) return body
  // El titulo sobra si la explicacion ya lo dice (casi todas sus palabras estan en ella)
  const t = words(title)
  const inBody = new Set(words(body))
  const covered = t.length > 0 && t.filter(w => inBody.has(w)).length / t.length >= 0.7
  return covered ? body : `${title.replace(/[.!?]+$/, '')}. ${body}`
}

const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)

const norm = (t: string) => t.replace(/\s+/g, '').toLowerCase()

/** Explicacion corta para escribir en la pizarra */
function shorten(text: string): string {
  const first = text.split(/(?<=[.!?])\s/)[0].trim()
  return first.length > 60 ? `${first.slice(0, 57)}…` : first
}

/** "Respuesta final: x = 5" -> "x = 5" (tambien "Final answer: ...") */
function cleanAnswer(text: string): string {
  return text.replace(/\*+/g, '').replace(/^\s*(respuesta|resultado|final)\s+(final|answer|result)\s*:?\s*/i, '').trim() || text
}
