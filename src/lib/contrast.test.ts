// Contraste de color (WCAG 2.x AA, lo que pide la ADA para la web): texto 4.5:1, controles y foco 3:1.
// Lee los colores de index.css para que un cambio de paleta que rompa el contraste falle aqui y no en produccion.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/index.css', 'utf8')

function vars(block: RegExp): Record<string, string> {
  const body = css.match(block)?.[1] ?? ''
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(m => [m[1], m[2]]))
}

const light = vars(/:root\s*\{([^}]*)\}/)
const dark = { ...light, ...vars(/\[data-theme="dark"\]\s*\{([^}]*)\}/) }

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Un color de rgba(fg, alpha) sobre un fondo opaco */
function over(fg: string, bg: string, alpha: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
  return '#' + [1, 3, 5].map(i => Math.round(alpha * ch(fg, i) + (1 - alpha) * ch(bg, i)).toString(16).padStart(2, '0')).join('')
}

type Theme = Record<string, string>
const AMBER = '#f59e0b'

// [descripcion, color, fondo, minimo]
const checks = (t: Theme, warningText: string): Array<[string, string, string, number]> => [
  // Texto (1.4.3): 4.5
  ['texto sobre fondo', t.text, t.bg, 4.5],
  ['texto sobre superficie', t.text, t.surface, 4.5],
  ['texto secundario sobre fondo (placeholder, ayudas, pista de Resolver)', t['text-secondary'], t.bg, 4.5],
  ['texto secundario sobre superficie', t['text-secondary'], t.surface, 4.5],
  ['texto secundario sobre hover', t['text-secondary'], t['surface-hover'], 4.5],
  ['blanco sobre primario (botones)', '#ffffff', t.primary, 4.5],
  ['blanco sobre primario en hover', '#ffffff', t['primary-hover'], 4.5],
  ['rosa de acento sobre superficie', t.accent, t.surface, 4.5],
  ['rosa de acento sobre fondo', t.accent, t.bg, 4.5],
  ['error sobre superficie', t.error, t.surface, 4.5],
  ['texto del aviso sobre su fondo', warningText, over(AMBER, t.surface, 0.1), 4.5],
  // No texto (1.4.11, 2.4.11): 3
  ['anillo de foco sobre superficie', t.focus, t.surface, 3],
  ['anillo de foco sobre fondo', t.focus, t.bg, 3],
  ['borde de campos sobre fondo', t['border-control'], t.bg, 3],
  ['borde de campos sobre superficie', t['border-control'], t.surface, 3],
  ['borde de campos sobre hover', t['border-control'], t['surface-hover'], 3],
  ['rosa de acento como borde o icono sobre superficie', t.accent, t.surface, 3],
]

describe.each([
  ['tema claro', light, '#92400e'],
  ['tema oscuro', dark, '#fbbf24'],
])('contraste WCAG AA, %s', (_name, theme, warningText) => {
  it.each(checks(theme, warningText))('%s', (_what, fg, bg, min) => {
    expect(ratio(fg, bg), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(min)
  })
})

describe('el primario no se usa como borde ni foco donde no llega a 3:1', () => {
  it('el primario sobre la superficie oscura no llega a 3:1, asi que el foco y los bordes usan --focus y --accent', () => {
    expect(ratio(dark.primary, dark.surface)).toBeLessThan(3)
    expect(css).not.toMatch(/outline:[^;]*var\(--primary\)/)
    expect(css).not.toMatch(/border:\s*\d+px dashed var\(--primary\)/)
  })
})
