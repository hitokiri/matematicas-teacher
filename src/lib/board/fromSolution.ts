// Convierte la explicacion del modelo (pasos con titulo, explicacion y operacion) en un guion
// de pizarra: cada paso escribe su operacion en un renglon nuevo.

import type { BoardItem, BoardScript, BoardStep } from './types'

export interface SolutionLike {
  problem: string
  steps: Array<{ step: number; explanation: string; title?: string | null; calculation?: string | null }>
  final_answer: string
}

/** Caracteres aproximados que caben en una columna de la cuadricula */
const CHARS_PER_COL = 1.6

export function solutionScript(solution: SolutionLike): BoardScript {
  let n = 0
  const line = (row: number, text: string, tone: 'op' | 'line-text' | 'result'): BoardItem =>
    ({ id: `s${n++}`, kind: 'text', row, col: 0, text, tone, align: 'start' })

  const answer = cleanAnswer(solution.final_answer)
  const steps: BoardStep[] = [{
    say: 'Este es el problema. ¡Vamos a resolverlo paso a paso!',
    add: [line(0, solution.problem, 'op')],
  }]
  let row = 1
  const written = [norm(solution.problem)]
  for (const s of solution.steps) {
    const title = s.title?.trim()
    const calc = s.calculation?.trim()
    // Lo que se escribe: la operacion; si repite lo de arriba, el titulo; si no, la explicacion corta
    const options = [calc, title, shorten(s.explanation)].filter((t): t is string => !!t)
    const text = options.find(t => norm(t) !== written[written.length - 1]) ?? options[0] ?? '…'
    written.push(norm(text))
    steps.push({
      say: title ? `${title}. ${s.explanation}` : s.explanation,
      add: [line(row, text, 'line-text')],
      focus: [[row, 0]],
    })
    row++
  }
  steps.push({ say: `¡Listo! La respuesta es ${answer}. 🎉`, add: [line(row, `✔ ${answer}`, 'result')] })

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

const norm = (t: string) => t.replace(/\s+/g, '').toLowerCase()

/** Explicacion corta para escribir en la pizarra */
function shorten(text: string): string {
  const first = text.split(/(?<=[.!?])\s/)[0].trim()
  return first.length > 60 ? `${first.slice(0, 57)}…` : first
}

/** "Respuesta final: x = 5" -> "x = 5" */
function cleanAnswer(text: string): string {
  return text.replace(/\*+/g, '').replace(/^\s*(respuesta|resultado)\s+final\s*:?\s*/i, '').trim() || text
}
