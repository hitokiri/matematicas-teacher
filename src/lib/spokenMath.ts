// Convierte lo que dice la maestra (con simbolos matematicos) en texto que una voz lee bien:
// "2x + 3y = 6" -> "dos equis más tres ye igual a seis". Es español de México.

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós',
  'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos',
  'ochocientos', 'novecientos']

/** 0-999 en palabras; `apocope` da "un"/"veintiún" (delante de "mil" o "millón") */
function below1000(n: number, apocope: boolean): string {
  if (n === 100) return 'cien'
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h) parts.push(HUNDREDS[h])
  if (rest) {
    if (rest < 30) {
      parts.push(apocope && rest === 1 ? 'un' : apocope && rest === 21 ? 'veintiún' : UNITS[rest])
    } else {
      const u = rest % 10
      parts.push(u ? `${TENS[Math.floor(rest / 10)]} y ${apocope && u === 1 ? 'un' : UNITS[u]}` : TENS[Math.floor(rest / 10)])
    }
  }
  return parts.join(' ')
}

/** Entero no negativo en palabras (hasta 999 999 999 999; mas alla se lee cifra por cifra) */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) return String(n)
  if (n < 30) return UNITS[n]
  if (n >= 1e12) return String(n).split('').map(d => UNITS[Number(d)]).join(' ')
  const millions = Math.floor(n / 1e6)
  const thousands = Math.floor((n % 1e6) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (millions) parts.push(millions === 1 ? 'un millón' : `${numberToWords(millions).replace(/uno$/, 'un')} millones`)
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${below1000(thousands, true)} mil`)
  if (rest) parts.push(below1000(rest, false))
  return parts.join(' ')
}

const DENOMINATORS: Record<number, [string, string]> = {
  2: ['medio', 'medios'], 3: ['tercio', 'tercios'], 4: ['cuarto', 'cuartos'], 5: ['quinto', 'quintos'],
  6: ['sexto', 'sextos'], 7: ['séptimo', 'séptimos'], 8: ['octavo', 'octavos'], 9: ['noveno', 'novenos'],
  10: ['décimo', 'décimos'],
}

function fraction(num: number, den: number): string {
  const d = DENOMINATORS[den]
  if (!d) return `${numberToWords(num)} entre ${numberToWords(den)}`
  return num === 1 ? `un ${d[0]}` : `${numberToWords(num)} ${d[1]}`
}

const LETTERS: Record<string, string> = {
  b: 'be', c: 'ce', d: 'de', f: 'efe', g: 'ge', h: 'hache', i: 'i', j: 'jota', k: 'ka', l: 'ele', m: 'eme', n: 'ene',
  p: 'pe', q: 'cu', r: 'erre', s: 'ese', t: 'te', v: 've', w: 'doble ve', x: 'equis', z: 'zeta',
}

const SYMBOLS: Array<[RegExp, string]> = [
  [/≤|<=/g, ' menor o igual que '], [/≥|>=/g, ' mayor o igual que '], [/≠/g, ' distinto de '],
  [/=/g, ' igual a '], [/</g, ' menor que '], [/>/g, ' mayor que '],
  [/±/g, ' más menos '], [/\+/g, ' más '], [/[×·*]/g, ' por '], [/÷/g, ' entre '],
  [/√/g, ' raíz cuadrada de '], [/π/g, ' pi '], [/∞/g, ' infinito '], [/%/g, ' por ciento '], [/°/g, ' grados '],
]

/** Quita emojis y adornos que la voz leeria como "carita" o ignoraria con ruido */
function strip(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}✔✗✓✘]/gu, ' ')
    .replace(/[“”«»"]/g, '')
}

export function spokenMath(input: string): string {
  let t = strip(input)

  // Potencias
  t = t.replace(/\^\s*\(?(-?\d+)\)?/g, (_, n) => (n === '2' ? ' al cuadrado ' : n === '3' ? ' al cubo ' : ` elevado a ${n} `))
  t = t.replace(/²/g, ' al cuadrado ').replace(/³/g, ' al cubo ')

  // Fracciones y divisiones entre enteros: 3/4 -> "tres cuartos"
  t = t.replace(/(?<![\d/])(\d+)\s*\/\s*(\d+)(?![\d/])/g, (_, a, b) => ` ${fraction(Number(a), Number(b))} `)
  t = t.replace(/\//g, ' entre ')

  // "3 x 4" es multiplicar; "2x" y "x + 1" son la letra
  t = t.replace(/(\d)\s+x\s+(?=\d)/g, '$1 por ')

  // Decimales: 3.5 / 3,5 -> "tres punto cinco"
  t = t.replace(/(\d+)[.,](\d+)/g, (_, a, b) => ` ${numberToWords(Number(a))} punto ${b.split('').map((d: string) => UNITS[Number(d)]).join(' ')} `)

  // Menos: signo delante de un numero o letra, o resta entre dos cosas
  t = t.replace(/[−–—-]/g, ' menos ')

  for (const [re, word] of SYMBOLS) t = t.replace(re, word)

  // Numeros (con separador de miles por espacio fino o coma ya resuelto arriba)
  t = t.replace(/\d+/g, m => ` ${numberToWords(Number(m))} `)

  // Letras sueltas (variables): "y" solo si no es la conjuncion
  t = t.replace(/(?<![\p{L}\d])([b-df-hj-np-xz])(?![\p{L}\d])/giu, (_, l: string) => LETTERS[l.toLowerCase()] ?? l)
  t = t.replace(/(?<![\p{L}\d])y(?![\p{L}\d])/gu, (m, offset: number, whole: string) => {
    const before = whole.slice(0, offset).trimEnd().split(/\s+/).pop() ?? ''
    const after = whole.slice(offset + 1).trimStart().split(/\s+/)[0] ?? ''
    const article = /^(la|las|cada|con|menos|más|igual|por)$/i.test(before)
    const nextIsMath = /^(igual|más|menos|por|entre|al|vale|es)$/.test(after)
    return article || nextIsMath ? 'ye' : m
  })

  // Parentesis y corchetes: una pausa
  t = t.replace(/[()[\]{}]/g, ', ')

  return t.replace(/\s+,/g, ',').replace(/,\s*,+/g, ',').replace(/\s+/g, ' ').replace(/\s+([.!?:;])/g, '$1').trim()
}
