import { SUPPORT_LABEL, TOPICS } from '../lib/capabilities'

interface LevelsPanelProps {
  /** Al pulsar un ejemplo se escribe en el cuadro del problema */
  onTry?: (example: string) => void
}

/** "¿Hasta dónde llega la maestra?": que temas explica la app sola, cuales el modelo y que viene */
export default function LevelsPanel({ onTry }: LevelsPanelProps) {
  const own = TOPICS.filter(t => t.support === 'app').length
  return (
    <details className="levels-panel">
      <summary>
        <span className="levels-title">🎓 ¿Hasta dónde llega la maestra?</span>
        <span className="levels-progress">
          <span className="levels-bar" aria-hidden="true">
            <span style={{ width: `${(own / TOPICS.length) * 100}%` }} />
          </span>
          {own} de {TOPICS.length} temas los explica la app sola
        </span>
      </summary>
      <p className="levels-intro">
        Los temas en verde los resuelve la app: siempre salen bien y sin saltarse pasos. Los demás los
        explica el modelo y conviene revisarlos. Pulsa un ejemplo para probarlo.
      </p>
      <ol className="levels-grid">
        {TOPICS.map((t, i) => (
          <li key={t.title} className={`level-card level-${t.support}`}>
            <div className="level-head">
              <span className="level-num">{i + 1}</span>
              <strong>{t.title}</strong>
            </div>
            <span className="level-badge">{SUPPORT_LABEL[t.support]}</span>
            <p>{t.how}</p>
            {t.examples.length > 0 && (
              <div className="level-examples">
                {t.examples.map(ex => (
                  <button
                    key={ex}
                    type="button"
                    className="level-example"
                    onClick={() => onTry?.(ex)}
                    title="Escribir este ejemplo"
                  >
                    {ex.replace('\n', ' ; ')}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}
