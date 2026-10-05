// Fracciones exactas (numerador/denominador) para ecuaciones y fracciones sin errores de decimales.

export interface Q {
  n: number
  d: number
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}

export const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b)

export function q(n: number, d = 1): Q {
  if (d === 0) throw new Error('division entre cero')
  if (!Number.isInteger(n) || !Number.isInteger(d)) {
    // decimales como 0.5 -> 1/2
    const scale = 10 ** Math.max(decimals(n), decimals(d))
    return q(Math.round(n * scale), Math.round(d * scale))
  }
  const g = gcd(n, d)
  const sign = d < 0 ? -1 : 1
  return { n: (sign * n) / g, d: (sign * d) / g }
}

function decimals(v: number): number {
  const s = String(v)
  return s.includes('.') ? s.split('.')[1].length : 0
}

export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
export const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d)
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
export const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n)
export const neg = (a: Q) => q(-a.n, a.d)
export const isZero = (a: Q) => a.n === 0
export const isInt = (a: Q) => a.d === 1
export const eq = (a: Q, b: Q) => a.n === b.n && a.d === b.d
export const value = (a: Q) => a.n / a.d

/** "3", "-3/2" */
export function show(a: Q): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`
}

/** Para escribir con signo en una expresion: "+ 4", "− 3/2" */
export function signed(a: Q): string {
  return a.n < 0 ? `− ${show(neg(a))}` : `+ ${show(a)}`
}
