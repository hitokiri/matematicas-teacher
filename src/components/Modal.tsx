import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  /** Id del titulo del dialogo (para que los lectores de pantalla lo anuncien) */
  labelledBy: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/**
 * Dialogo modal accesible: el foco entra y se queda dentro (Tab da la vuelta), Esc lo cierra,
 * el resto de la pagina queda inerte (ni se enfoca ni se lee) y el foco regresa al boton que lo abrio.
 */
export default function Modal({ labelledBy, onClose, children }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const root = dialog.current
    if (!root) return
    const opener = document.activeElement as HTMLElement | null
    root.focus()

    // El fondo queda inerte mientras el dialogo esta abierto
    const overlay = root.parentElement
    const background = overlay?.parentElement
      ? Array.from(overlay.parentElement.children).filter(el => el !== overlay)
      : []
    background.forEach(el => el.setAttribute('inert', ''))

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      background.forEach(el => el.removeAttribute('inert'))
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={dialog}>
        {children}
      </div>
    </div>
  )
}
