import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import '@fontsource/patrick-hand'
import type { BoardItem, BoardScript } from '../lib/board/types'
import { MAX_ROWS_PER_PAGE, pageOf, rowOnPage } from '../lib/board/paginate'
import BoardVisual from './BoardVisual'
import { FONT_SCALES } from '../lib/uiPrefs'

// Geometria de la cuadricula (unidades del viewBox del SVG)
const CW = 52
const CH = 60
const PAD = 24
/** Retraso entre trazos de un mismo paso (segundos) */
const STAGGER = 0.35
/** Tamano en pantalla (px) de la letra de los renglones con tamano de letra 1 */
const TEXT_PX = 32
/** Tamano de letra de los renglones en unidades del viewBox (ver renderItem) */
const TEXT_UNITS = 36
/** Ancho de una letra de tiza (Patrick Hand) en unidades del viewBox, un poco de sobra */
const CHAR_UNITS = 16

interface ChalkboardProps {
  script: BoardScript
  /** Empieza a reproducir solo (por defecto si) */
  autoPlay?: boolean
  /** Avisa el paso que se esta viendo (0 = primero) */
  onStepChange?: (step: number) => void
  /** Al pulsar el numero de un paso (para preguntar por el en el chat) */
  onAskStep?: (step: number) => void
  /** Renglones que caben en una pizarra antes de pasar a la siguiente */
  maxRowsPerPage?: number
  /** Ver todas las pizarras juntas; si no, solo la que se esta viendo (el usuario puede cambiarlo) */
  showAllPages?: boolean
  /** Tamano de la letra de la pizarra y de la explicacion (1 = normal) */
  fontScale?: number
  /** Al cambiar el tamano de letra desde la pizarra (para guardarlo) */
  onFontScaleChange?: (scale: number) => void
}

/** Ancho de la columna de numeros de paso en los problemas de renglones */
const GUTTER = 58

/** Tiempo que se queda cada paso al reproducir: lo que tarda en escribirse + leerlo */
function stepDuration(script: BoardScript, step: number): number {
  const s = script.steps[step]
  return Math.min(9000, 1400 + s.add.length * STAGGER * 1000 + s.say.length * 45)
}

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

export default function Chalkboard({
  script, autoPlay = true, onStepChange, onAskStep, maxRowsPerPage = MAX_ROWS_PER_PAGE, showAllPages = false,
  fontScale = 1, onFontScaleChange,
}: ChalkboardProps) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [voice, setVoice] = useState(false)
  /** Pizarra que el usuario eligio ver; si no, se sigue a la que se esta escribiendo */
  const [pinned, setPinned] = useState<number | null>(null)
  const [allPages, setAllPages] = useState(showAllPages)
  useEffect(() => setAllPages(showAllPages), [showAllPages])
  const last = script.steps.length - 1

  // Reiniciar cuando cambia el problema
  useEffect(() => {
    setStep(0)
    setPlaying(autoPlay)
    setPinned(null)
  }, [script, autoPlay])

  useEffect(() => {
    if (!playing) return
    if (step >= last) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => setStep(s => Math.min(s + 1, last)), stepDuration(script, step))
    return () => window.clearTimeout(t)
  }, [playing, step, last, script])

  useEffect(() => {
    onStepChange?.(Math.min(step, last))
  }, [step, last, onStepChange])

  // Lectura en voz alta (si el sistema la soporta)
  useEffect(() => {
    if (!voice || !canSpeak) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(script.steps[Math.min(step, last)].say.replace(/[🎉✔]/gu, ''))
    u.lang = 'es-MX'
    window.speechSynthesis.speak(u)
  }, [voice, step, script, last])

  // Trazos visibles hasta el paso actual; los del paso actual se animan
  const { visible, fresh } = useMemo(() => {
    const items = new Map<string, BoardItem>()
    for (const s of script.steps.slice(0, step + 1)) {
      s.remove?.forEach(id => items.delete(id))
      s.add.forEach(i => items.set(i.id, i))
    }
    const fresh = new Map(script.steps[Math.min(step, last)].add.map((i, k) => [i.id, k]))
    return { visible: [...items.values()], fresh }
  }, [script, step, last])

  // Dibujo del paso (balanza, pizzas...): el ultimo definido hasta el paso actual
  let visualStep = -1
  for (let i = 0; i <= Math.min(step, last); i++) if (script.steps[i].visual) visualStep = i
  const visual = visualStep >= 0 ? script.steps[visualStep].visual : undefined

  // Numero de paso de cada renglon: solo el primer renglon que escribe cada paso
  const { stepOf, lined } = useMemo(() => {
    const stepOf = new Map<string, number>()
    script.steps.forEach((s, i) => {
      const first = s.add.find(it => it.kind === 'text' && it.align === 'start')
      if (first) stepOf.set(first.id, i)
    })
    return { stepOf, lined: stepOf.size > 0 }
  }, [script])
  const gutter = lined ? GUTTER : 0

  // Pizarras: la maestra usa la otra parte cuando se llenan los renglones
  const pages = Math.max(1, Math.ceil(script.rows / maxRowsPerPage))
  const current = script.steps[Math.min(step, last)]
  // Un paso que no escribe nada (p. ej. el "¡Listo!") se queda en la pizarra del ultimo renglon escrito
  let writeRow = 0
  for (let i = Math.min(step, last); i >= 0; i--) {
    const s = script.steps[i]
    const r = s.focus?.[0]?.[0] ?? s.add.find(it => it.kind === 'text')?.row
    if (r !== undefined) { writeRow = r; break }
  }
  const activePage = pageOf(writeRow, maxRowsPerPage)
  const viewPage = pinned ?? activePage
  const byPage = useMemo(() => {
    const groups: BoardItem[][] = Array.from({ length: pages }, () => [] as BoardItem[])
    for (const item of visible) groups[pageOf(item.row, maxRowsPerPage)].push(item)
    return groups
  }, [visible, pages, maxRowsPerPage])

  const width = PAD * 2 + gutter + script.cols * CW

  // Renglones de texto: la letra tiene un tamano fijo en pantalla (no se encoge si un renglon es largo)
  // y la pizarra llena el ancho disponible. Si un renglon no cabe, la pizarra se desplaza de lado.
  const pagesRef = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  useEffect(() => {
    const el = pagesRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const zoom = (TEXT_PX / TEXT_UNITS) * fontScale
  const together = pages > 1 && allPages
  const pageAvail = together ? Math.max(300, (avail - 12 * (pages - 1)) / pages) : avail
  // Ancho que de verdad ocupan los renglones (script.cols sobreestima el texto: es para cuentas en columna)
  const textW = useMemo(() => {
    let units = 0
    for (const st of script.steps) {
      for (const it of st.add) {
        if (it.kind === 'text' && it.align === 'start') {
          const chars = it.parts ? it.parts.reduce((n, p) => n + p.text.length, 0) : it.text.length
          units = Math.max(units, it.col * CW + 8 + chars * CHAR_UNITS * (it.small ? 26 / TEXT_UNITS : 1))
        } else if (it.kind === 'line') units = Math.max(units, (it.to + 1) * CW)
        else units = Math.max(units, (it.col + 1) * CW)
      }
    }
    return PAD * 2 + gutter + units
  }, [script, gutter])
  const boardW = lined ? Math.max(textW, pageAvail / zoom) : width
  const boardStyle = (rowsHere: number): CSSProperties | undefined => lined
    ? { width: boardW * zoom, height: (PAD * 2 + rowsHere * CH) * zoom, maxWidth: 'none', maxHeight: 'none' }
    : { maxHeight: `${(together ? 46 : 62) * fontScale}vh` }
  const scaleIdx = FONT_SCALES.findIndex(f => f >= fontScale - 0.001)
  const setScale = (i: number) => onFontScaleChange?.(FONT_SCALES[Math.max(0, Math.min(FONT_SCALES.length - 1, i))])
  const rowIsText = (r: number) => visible.some(i => i.kind === 'text' && i.row === r && i.align === 'start')

  const go = (s: number) => {
    setPlaying(false)
    setStep(Math.max(0, Math.min(last, s)))
  }

  return (
    <div className="chalkboard-section" style={{ '--font-scale': fontScale } as CSSProperties}>
      <div className="chalkboard-frame">
        {pages > 1 && (
          <div className="chalk-pages-nav">
            {Array.from({ length: pages }, (_, p) => (
              <button
                key={p}
                className={`page-chip ${p === viewPage ? 'active' : ''}`}
                onClick={() => setPinned(p)}
                aria-current={p === viewPage ? 'true' : undefined}
              >
                Pizarra {p + 1}
              </button>
            ))}
            <button
              className="page-chip page-chip-toggle"
              onClick={() => setAllPages(a => !a)}
              aria-pressed={allPages}
              title={allPages ? 'Ver solo la pizarra elegida' : 'Ver todas las pizarras juntas'}
            >
              {allPages ? '📄 Una a la vez' : '🗂 Ver todas'}
            </button>
          </div>
        )}

        <div ref={pagesRef} className={`chalk-pages ${together ? 'multi' : ''}`}>
          {Array.from({ length: pages }, (_, p) => {
            // Una a la vez: solo se dibuja la pizarra que se esta viendo (ahorra espacio)
            if (!allPages && p !== viewPage) return null
            const rowsHere = Math.min(maxRowsPerPage, script.rows - p * maxRowsPerPage)
            const items = byPage[p]
            const isView = p === viewPage
            return (
              <div key={p} className={`chalk-page ${isView ? 'active' : ''}`}>
                {pages > 1 && allPages && <div className="chalk-page-label">Pizarra {p + 1}</div>}
                <svg
                  className="chalkboard"
                  viewBox={`0 0 ${boardW} ${PAD * 2 + rowsHere * CH}`}
                  style={boardStyle(rowsHere)}
                  role="img"
                  aria-label={pages > 1 ? `Pizarra ${p + 1}: ${script.title}` : `Pizarra: ${script.title}`}
                >
                  {lined && items.map(item => {
                    const n = stepOf.get(item.id)
                    if (n === undefined || item.kind !== 'text') return null
                    return (
                      <StepBadge
                        key={`b${item.id}`}
                        n={n + 1}
                        x={PAD + 22}
                        y={PAD + rowOnPage(item.row, maxRowsPerPage) * CH + CH / 2}
                        active={n === Math.min(step, last)}
                        onClick={onAskStep ? () => onAskStep(n) : undefined}
                      />
                    )
                  })}
                  <g transform={`translate(${gutter} 0)`}>
                    {isView && current.focus?.map(([r, c], k) => {
                      if (pageOf(r, maxRowsPerPage) !== p) return null
                      const wide = rowIsText(r)
                      return (
                        <rect
                          key={`f${step}-${k}`}
                          className="chalk-focus"
                          x={PAD + (wide ? 0 : c * CW) + 2}
                          y={PAD + rowOnPage(r, maxRowsPerPage) * CH + 4}
                          width={(wide ? (boardW - PAD * 2 - gutter) / CW : 1) * CW - 4}
                          height={CH - 8}
                          rx={12}
                        />
                      )
                    })}
                    {items.map(item => {
                      const order = fresh.get(item.id)
                      const isNew = order !== undefined
                      const style = isNew ? ({ '--d': `${order * STAGGER}s` } as CSSProperties) : undefined
                      return (
                        <g key={isNew ? `${item.id}-${step}` : item.id} className={isNew ? 'chalk-new' : undefined} style={style}>
                          {renderItem(item, rowOnPage(item.row, maxRowsPerPage), rowsHere)}
                        </g>
                      )
                    })}
                    {/* Cuentas en columna: el numero del paso junto a lo que se escribe ahora */}
                    {!lined && isView && step > 0 && current.focus?.[0] && pageOf(current.focus[0][0], maxRowsPerPage) === p && (
                      <StepBadge
                        n={Math.min(step, last) + 1}
                        x={PAD + (current.focus[current.focus.length - 1][1] + 1) * CW + 4}
                        y={PAD + rowOnPage(current.focus[current.focus.length - 1][0], maxRowsPerPage) * CH + 14}
                        active
                        small
                        onClick={onAskStep ? () => onAskStep(Math.min(step, last)) : undefined}
                      />
                    )}
                  </g>
                </svg>
              </div>
            )
          })}
        </div>

        {visual && (
          <div className="board-visual-wrap" key={visualStep}>
            <BoardVisual visual={visual} />
          </div>
        )}
      </div>

      <div className="chalk-narration" aria-live="polite">
        <span className="chalk-teacher" aria-hidden="true">👩‍🏫</span>
        <div>
          <div className="chalk-step-count">
            Paso {step + 1} de {script.steps.length}
            {pages > 1 && ` · pizarra ${viewPage + 1} de ${pages}`}
          </div>
          <p>{current.say}</p>
        </div>
      </div>

      <div className="chalk-controls">
        <button className="btn btn-secondary" onClick={() => { setStep(0); setPlaying(true) }} title="Empezar de nuevo">⏮ Otra vez</button>
        <button className="btn btn-secondary" onClick={() => go(step - 1)} disabled={step === 0}>◀ Anterior</button>
        <button className="btn btn-primary" onClick={() => setPlaying(p => !p)} disabled={step === last && !playing}>
          {playing ? '⏸ Pausa' : '▶ Reproducir'}
        </button>
        <button className="btn btn-secondary" onClick={() => go(step + 1)} disabled={step === last}>Siguiente ▶</button>
        {canSpeak && (
          <button
            className={`btn btn-secondary ${voice ? 'active' : ''}`}
            onClick={() => setVoice(v => { if (v) window.speechSynthesis.cancel(); return !v })}
            title="Leer en voz alta"
          >
            {voice ? '🔊' : '🔈'}
          </button>
        )}
        {onFontScaleChange && (
          <div className="font-size-controls" role="group" aria-label="Tamaño de letra">
            <button
              className="btn btn-secondary"
              onClick={() => setScale(scaleIdx - 1)}
              disabled={scaleIdx <= 0}
              aria-label="Letra más chica"
              title="Letra más chica"
            >
              A−
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setScale(scaleIdx + 1)}
              disabled={scaleIdx >= FONT_SCALES.length - 1}
              aria-label="Letra más grande"
              title="Letra más grande"
            >
              A+
            </button>
          </div>
        )}
      </div>

      {step === last && (
        <div className="final-answer chalk-answer">
          <div className="chalk-answer-emoji">🎉</div>
          <div>Resultado: <strong>{script.answer}</strong></div>
        </div>
      )}
    </div>
  )
}

function StepBadge({ n, x, y, active, small, onClick }: {
  n: number; x: number; y: number; active?: boolean; small?: boolean; onClick?: () => void
}) {
  const r = small ? 14 : 18
  return (
    <g
      className={`step-badge ${active ? 'active' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `Preguntar por el paso ${n}` : `Paso ${n}`}
    >
      <circle cx={x} cy={y} r={r} />
      <text x={x} y={y + (small ? 6 : 7)} textAnchor="middle" fontSize={small ? 17 : 21}>{n}</text>
    </g>
  )
}

/** `row` es el renglon dentro de la pizarra donde se dibuja el trazo */
function renderItem(item: BoardItem, row: number, lastRow = MAX_ROWS_PER_PAGE) {
  const x0 = (c: number) => PAD + c * CW
  const y0 = (r: number) => PAD + r * CH
  switch (item.kind) {
    case 'text': {
      const start = item.align === 'start'
      const size = item.small ? 26 : start ? 36 : 46
      return (
        <text
          className={`chalk-text tone-${item.tone ?? 'normal'}`}
          x={start ? x0(item.col) + 8 : x0(item.col) + CW / 2}
          y={y0(row) + (item.small ? CH * 0.75 : CH * 0.7)}
          fontSize={size}
          textAnchor={start ? 'start' : 'middle'}
        >
          {item.parts
            ? item.parts.map((p, k) => (
                <tspan key={k} className={p.tone ? `tone-${p.tone}` : undefined}>{p.text}</tspan>
              ))
            : item.text}
        </text>
      )
    }
    case 'line':
      return (
        <line
          className="chalk-line"
          x1={x0(item.from) + 4}
          x2={x0(item.to + 1) - 4}
          y1={y0(Math.min(row + 1, lastRow)) - 4}
          y2={y0(Math.min(row + 1, lastRow)) - 2}
        />
      )
    case 'strike':
      return (
        <line
          className="chalk-line chalk-strike"
          x1={x0(item.col) + 12}
          y1={y0(row) + CH - 12}
          x2={x0(item.col) + CW - 12}
          y2={y0(row) + 14}
        />
      )
    case 'bracket':
      return (
        <path
          className="chalk-line"
          fill="none"
          d={`M ${x0(item.col) - 6} ${y0(row) + CH - 4} L ${x0(item.col) - 6} ${y0(row) + 4} L ${x0(item.col + item.width) + 4} ${y0(row) + 4}`}
        />
      )
  }
}
