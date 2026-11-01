// Reconoce cuentas sencillas con numeros enteros ("10 x 20", "47 + 38 = ?", "156 entre 12")
// para resolverlas en la pizarra con el algoritmo de la escuela, sin usar el modelo.

export type Arithmetic =
  | { op: '+'; numbers: string[] }
  | { op: '-' | '*' | '/'; a: string; b: string }

const MAX_DIGITS = 7

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const TENS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
}
const plain = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** "trescientos cincuenta y dos" -> "352", "dos mil" -> "2000" (el resto del texto se deja igual) */
export function wordsToDigits(text: string): string {
  const tokens = text.split(/(\s+)/) // se conservan los espacios
  const out: string[] = []
  let total = 0
  let current = 0
  let inRun = false
  let pendingSpace = ''
  const isNum = (w: string) => w in UNITS || w in TENS || w in HUNDREDS || w === 'mil' || w === 'millon' || w === 'millones'
  const flush = () => {
    if (inRun) out.push(String(total + current))
    total = current = 0
    inRun = false
  }
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (/^\s+$/.test(tok)) {
      pendingSpace = tok
      continue
    }
    const w = plain(tok.toLowerCase())
    // "treinta Y cinco": la y solo une decenas con unidades
    // "un" y "una" suelen ser articulos ("un ejemplo"): solo cuentan dentro de un numero o antes de "mil"
    const article = w === 'un' || w === 'una'
    const nextWord = plain((tokens[i + 2] ?? '').toLowerCase())
    if (article && !inRun && !/^mil(lon|lones)?$/.test(nextWord)) {
      flush()
      if (pendingSpace) out.push(pendingSpace)
      pendingSpace = ''
      out.push(tok)
      continue
    }
    const joinsTens = w === 'y' && inRun && current % 100 >= 30 && current % 10 === 0 && plain((tokens[i + 2] ?? '').toLowerCase()) in UNITS
    if (isNum(w) || joinsTens) {
      if (!inRun) { if (pendingSpace) out.push(pendingSpace); inRun = true }
      pendingSpace = ''
      if (joinsTens) continue
      if (w === 'mil') { total += (current || 1) * 1000; current = 0 }
      else if (w === 'millon' || w === 'millones') { total += (current || 1) * 1_000_000; current = 0 }
      else current += UNITS[w] ?? TENS[w] ?? HUNDREDS[w]
      continue
    }
    flush()
    if (pendingSpace) out.push(pendingSpace)
    pendingSpace = ''
    out.push(tok)
  }
  flush()
  return out.join('')
}

/** "divide 300 entre 50" -> "300 entre 50" (el verbo dice la operacion) */
function verbForm(s: string): string {
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(?:divide|dividir|divida|dividimos)\s+(.+?)\s+(?:entre|por)\s+(.+)$/))) return `${m[1]} entre ${m[2]}`
  if ((m = s.match(/^(?:multiplica|multiplicar|multiplicamos)\s+(.+?)\s+(?:por|y)\s+(.+)$/))) return `${m[1]} por ${m[2]}`
  if ((m = s.match(/^(?:suma|sumar|sumamos|agrega)\s+(.+?)\s+(?:y|con|mas|más)\s+(.+)$/))) return `${m[1]} más ${m[2]}`
  if ((m = s.match(/^(?:resta|restar|restamos)\s+(.+?)\s+de\s+(.+)$/))) return `${m[2]} menos ${m[1]}`
  if ((m = s.match(/^(?:resta|restar|restamos)\s+(.+?)\s+(?:menos|y)\s+(.+)$/))) return `${m[1]} menos ${m[2]}`
  return s
}

export function parseArithmetic(input: string): Arithmetic | null {
  let s = input.toLowerCase().trim()
  s = s.replace(/^(cu[aá]nto es|cu[aá]nto da|resuelve|calcula)\s*/, '')
  s = s.replace(/[.!]+\s*$/, '').replace(/\s*(=\s*)?\??\s*$/, '')
  s = verbForm(wordsToDigits(s))
  s = s
    .replace(/\s+(por)\s+/g, ' * ')
    .replace(/\s+(m[aá]s)\s+/g, ' + ')
    .replace(/\s+(menos)\s+/g, ' - ')
    .replace(/\s+(entre|dividido entre|dividido por)\s+/g, ' / ')
    .replace(/[×x·]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '')

  const valid = (n: string) => n.length <= MAX_DIGITS
  const clean = (n: string) => n.replace(/^0+(?=\d)/, '')

  if (/^\d+(\+\d+)+$/.test(s)) {
    const numbers = s.split('+').map(clean)
    return numbers.every(valid) ? { op: '+', numbers } : null
  }
  const m = s.match(/^(\d+)([-*/])(\d+)$/)
  if (!m) return null
  const [, a, op, b] = m
  if (!valid(a) || !valid(b)) return null
  // "1/2" o "3/4" son fracciones, no una division en casita
  if (op === '/' && /\//.test(input) && BigInt(a) < BigInt(b)) return null
  return { op: op as '-' | '*' | '/', a: clean(a), b: clean(b) }
}

/** Nombre de la posicion de un digito contando desde las unidades (0) */
export function placeName(position: number): string {
  const names = [
    'unidades', 'decenas', 'centenas',
    'unidades de millar', 'decenas de millar', 'centenas de millar',
    'unidades de millón', 'decenas de millón', 'centenas de millón',
  ]
  return names[position] ?? `posición ${position + 1}`
}

export const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' } as const
