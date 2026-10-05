// Reconoce cuentas sencillas con numeros enteros ("10 x 20", "47 + 38 = ?", "156 entre 12")
// para resolverlas en la pizarra con el algoritmo de la escuela, sin usar el modelo.

export type Arithmetic =
  | { op: '+'; numbers: string[] }
  | { op: '-' | '*' | '/'; a: string; b: string }

const MAX_DIGITS = 7

export function parseArithmetic(input: string): Arithmetic | null {
  let s = input.toLowerCase().trim()
  s = s.replace(/^(cu[aá]nto es|cu[aá]nto da|resuelve|calcula)\s*/, '')
  s = s.replace(/\s*(=\s*)?\??\s*$/, '')
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
