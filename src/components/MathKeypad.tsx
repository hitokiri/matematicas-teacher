// Simbolos matematicos para quien no sabe sacarlos con el teclado. Cada boton muestra el simbolo
// y trae su nombre hablado (lectores de pantalla); Escape cierra y devuelve el foco al boton.

import { useEffect, useRef } from 'react'
import { useI18n, type MessageKey } from '../lib/i18n'

/** [simbolo que se escribe, clave del nombre] */
const SYMBOLS: Array<[string, MessageKey]> = [
  ['+', 'sym.plus'], ['−', 'sym.minus'], ['×', 'sym.times'], ['÷', 'sym.divide'],
  ['=', 'sym.equals'], ['/', 'sym.fraction'], ['(', 'sym.openParen'], [')', 'sym.closeParen'],
  ['√(', 'sym.sqrt'], ['²', 'sym.squared'], ['³', 'sym.cubed'], ['^', 'sym.power'],
  ['x', 'sym.x'], ['y', 'sym.y'], ['.', 'sym.point'],
]

interface MathKeypadProps {
  id: string
  onInsert: (symbol: string) => void
  onClose: () => void
}

export default function MathKeypad({ id, onInsert, onClose }: MathKeypadProps) {
  const { t } = useI18n()
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => { first.current?.focus() }, [])

  return (
    <div
      id={id}
      className="math-keypad"
      role="group"
      aria-label={t('keypad.label')}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
    >
      <p className="math-keypad-hint">{t('keypad.hint')}</p>
      <div className="math-keypad-keys">
        {SYMBOLS.map(([symbol, key], i) => (
          <button
            key={key}
            ref={i === 0 ? first : undefined}
            type="button"
            className="math-key"
            aria-label={t(key)}
            title={t(key)}
            onClick={() => onInsert(symbol)}
          >
            <span aria-hidden="true">{symbol}</span>
            <small aria-hidden="true">{t(key)}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
