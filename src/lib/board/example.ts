import { wordsToDigits } from './parse'

// Ejemplo que el nino pide en el chat ("¿y como seria 3/4 + 1/2?"): se saca el problema de la
// pregunta y se comprueba que la app sepa resolverlo en la pizarra.

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/** "mil 10" -> 1010, "mil" -> 1000, "3 mil" -> 3000 (como se dicta una cuenta) */
function thousands(text: string): string {
  return text
    .replace(/\bmil\s+(\d{1,3})\b/gi, (_, n) => String(1000 + Number(n)))
    .replace(/\b(\d{1,3})\s+mil\b/gi, (_, n) => String(Number(n) * 1000))
    .replace(/\bmil\b/gi, '1000')
}

const OPERATOR = /[+\-−–×*÷/:=√^]|\b(entre|por|m[aá]s|menos|dividido|multiplicado|veces)\b/i

/** El problema que hay dentro de una pregunta, o null si no hay uno que `solvable` acepte */
export function exampleProblem(question: string, solvable: (text: string) => boolean): string | null {
  const text = wordsToDigits(thousands(question))
  const start = text.search(/[\d√(]/)
  if (start < 0) return null
  // Se corta lo que sobra antes y despues ("¿y si fuera ... ?")
  const candidate = text.slice(start).replace(/[^\d)xyz]+$/i, '').trim()
  // Un numero suelto ("se resta 4") es una duda del paso, no un ejemplo
  if (!OPERATOR.test(candidate)) return null
  return solvable(candidate) ? candidate : null
}

/** "Resuelve eso en la pizarra", "hazlo en la pizarra": pide ver en la pizarra lo que ya se hablo */
const WANTS_BOARD = /\b(pizarr[oa]n?|board|blackboard|whiteboard)\b/i

/** El ejemplo de una pregunta; si solo pide "en la pizarra", el ultimo problema de la conversacion */
export function exampleFromChat(question: string, history: ChatTurn[], solvable: (text: string) => boolean): string | null {
  const direct = exampleProblem(question, solvable)
  if (direct || !WANTS_BOARD.test(question)) return direct
  for (const turn of [...history].reverse()) {
    // La maestra suele escribir "Problema: 1010 ÷ 20 = ?" al armar el ejemplo
    const stated = turn.role === 'assistant' ? turn.content.match(/^\W*Problema:\s*(.+)$/im)?.[1] : undefined
    const found = (stated && exampleProblem(stated, solvable)) || exampleProblem(turn.content, solvable)
    if (found) return found
  }
  return null
}

const BOARD_TAG = /\[\[\s*PIZARRA\s*:\s*([^\]]+?)\s*\]\]/gi

/** La maestra pide un ejemplo con [[PIZARRA: 1010 ÷ 20]]: se separa del texto que se muestra y se lee */
export function splitBoardTag(reply: string): { text: string; problem: string | null } {
  let problem: string | null = null
  const text = reply.replace(BOARD_TAG, (_, p: string) => { problem ??= p.trim(); return '' }).replace(/\n{3,}/g, '\n\n').trim()
  if (problem) return { text, problem }
  // Si no uso la etiqueta pero escribio "Problema: 1010 ÷ 20 = ?", se aprovecha eso
  const stated = reply.match(/^\W*Problema:\s*(.+)$/im)?.[1]
  return { text, problem: stated ? stated.replace(/[\s=?]+$/, '').trim() : null }
}
