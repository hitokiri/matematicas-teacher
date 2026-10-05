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
  for (const s of solution.steps) {
    const title = s.title?.trim()
    const calc = s.calculation?.trim()
    const text = calc || title || ''
    const add = text ? [line(row, text, 'line-text')] : []
    steps.push({
      say: title ? `${title}. ${s.explanation}` : s.explanation,
      add,
      focus: text ? [[row, 0]] : undefined,
    })
    if (text) row++
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

/** "Respuesta final: x = 5" -> "x = 5" */
function cleanAnswer(text: string): string {
  return text.replace(/\*+/g, '').replace(/^\s*(respuesta|resultado)\s+final\s*:?\s*/i, '').trim() || text
}
