import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import '@fontsource/patrick-hand'
import type { BoardItem, BoardScript } from '../lib/board/types'
import BoardVisual from './BoardVisual'

// Geometria de la cuadricula (unidades del viewBox del SVG)
const CW = 52
const CH = 60
const PAD = 24
/** Retraso entre trazos de un mismo paso (segundos) */
const STAGGER = 0.35

interface ChalkboardProps {
  script: BoardScript
  /** Empieza a reproducir solo (por defecto si) */
  autoPlay?: boolean
  /** Avisa el paso que se esta viendo (0 = primero) */
  onStepChange?: (step: number) => void
  /** Al pulsar el numero de un paso (para preguntar por el en el chat) */
  onAskStep?: (step: number) => void
}

/** Ancho de la columna de numeros de paso en los problemas de renglones */
const GUTTER = 58

/** Tiempo que se queda cada paso al reproducir: lo que tarda en escribirse + leerlo */
function stepDuration(script: BoardScript, step: number): number {
  const s = script.steps[step]
  return Math.min(9000, 1400 + s.add.length * STAGGER * 1000 + s.say.length * 45)
}

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

export default function Chalkboard({ script, autoPlay = true, onStepChange, onAskStep }: ChalkboardProps) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [voice, setVoice] = useState(false)
  const last = script.steps.length - 1

  // Reiniciar cuando cambia el problema
  useEffect(() => {
    setStep(0)
    setPlaying(autoPlay)
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

  const width = PAD * 2 + gutter + script.cols * CW
  const height = PAD * 2 + script.rows * CH
  const current = script.steps[Math.min(step, last)]
  const rowIsText = (r: number) => visible.some(i => i.kind === 'text' && i.row === r && i.align === 'start')

  const go = (s: number) => {
    setPlaying(false)
    setStep(Math.max(0, Math.min(last, s)))
  }

  return (
    <div className="chalkboard-section">
      <div className="chalkboard-frame">
        <svg
          className="chalkboard"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Pizarra: ${script.title}`}
        >
          {lined && visible.map(item => {
            const n = stepOf.get(item.id)
            if (n === undefined || item.kind !== 'text') return null
            return (
              <StepBadge
                key={`b${item.id}`}
                n={n + 1}
                x={PAD + 22}
                y={PAD + item.row * CH + CH / 2}
                active={n === Math.min(step, last)}
                onClick={onAskStep ? () => onAskStep(n) : undefined}
              />
            )
          })}
          <g transform={`translate(${gutter} 0)`}>
          {current.focus?.map(([r, c], k) => {
            const wide = rowIsText(r)
            return (
              <rect
                key={`f${step}-${k}`}
                className="chalk-focus"
                x={PAD + (wide ? 0 : c * CW) + 2}
                y={PAD + r * CH + 4}
                width={(wide ? script.cols : 1) * CW - 4}
                height={CH - 8}
                rx={12}
              />
            )
          })}
          {visible.map(item => {
            const order = fresh.get(item.id)
            const isNew = order !== undefined
            const style = isNew ? ({ '--d': `${order * STAGGER}s` } as CSSProperties) : undefined
            return (
              <g key={isNew ? `${item.id}-${step}` : item.id} className={isNew ? 'chalk-new' : undefined} style={style}>
                {renderItem(item)}
              </g>
            )
          })}
          {/* Cuentas en columna: el numero del paso junto a lo que se escribe ahora */}
          {!lined && current.focus?.[0] && step > 0 && (
            <StepBadge
              n={Math.min(step, last) + 1}
              x={PAD + (current.focus[current.focus.length - 1][1] + 1) * CW + 4}
              y={PAD + current.focus[current.focus.length - 1][0] * CH + 14}
              active
              small
              onClick={onAskStep ? () => onAskStep(Math.min(step, last)) : undefined}
            />
          )}
          </g>
        </svg>
        {visual && (
          <div className="board-visual-wrap" key={visualStep}>
            <BoardVisual visual={visual} />
          </div>
        )}
      </div>

      <div className="chalk-narration" aria-live="polite">
        <span className="chalk-teacher" aria-hidden="true">👩‍🏫</span>
        <div>
          <div className="chalk-step-count">Paso {step + 1} de {script.steps.length}</div>
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

function renderItem(item: BoardItem) {
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
          y={y0(item.row) + (item.small ? CH * 0.75 : CH * 0.7)}
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
          y1={y0(item.row + 1) - 4}
          y2={y0(item.row + 1) - 2}
        />
      )
    case 'strike':
      return (
        <line
          className="chalk-line chalk-strike"
          x1={x0(item.col) + 12}
          y1={y0(item.row) + CH - 12}
          x2={x0(item.col) + CW - 12}
          y2={y0(item.row) + 14}
        />
      )
    case 'bracket':
      return (
        <path
          className="chalk-line"
          fill="none"
          d={`M ${x0(item.col) - 6} ${y0(item.row) + CH - 4} L ${x0(item.col) - 6} ${y0(item.row) + 4} L ${x0(item.col + item.width) + 4} ${y0(item.row) + 4}`}
        />
      )
  }
}
