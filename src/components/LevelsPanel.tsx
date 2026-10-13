import { TOPICS } from '../lib/capabilities'
import { useT, type MessageKey } from '../lib/i18n'

const SUPPORT_ICON = { app: '✔', model: '🤖', soon: '🔜' } as const

interface LevelsPanelProps {
  /** Al pulsar un ejemplo se escribe en el cuadro del problema */
  onTry?: (example: string) => void
}

/** "¿Hasta dónde llega la maestra?": que temas explica la app sola, cuales el modelo y que viene */
export default function LevelsPanel({ onTry }: LevelsPanelProps) {
  const t = useT()
  const own = TOPICS.filter(topic => topic.support === 'app').length
  return (
    <details className="levels-panel">
      <summary>
        <span className="levels-title"><span aria-hidden="true">🎓</span> {t('levels.title')}</span>
        <span className="levels-progress">
          <span className="levels-bar" aria-hidden="true">
            <span style={{ width: `${(own / TOPICS.length) * 100}%` }} />
          </span>
          {t('levels.progress', { own, total: TOPICS.length })}
        </span>
      </summary>
      <p className="levels-intro">{t('levels.intro')}</p>
      <ol className="levels-grid">
        {TOPICS.map((topic, i) => (
          <li key={topic.id} className={`level-card level-${topic.support}`}>
            <div className="level-head">
              <span className="level-num">{i + 1}</span>
              <strong>{t(`topic.${topic.id}.title` as MessageKey)}</strong>
            </div>
            <span className="level-badge"><span aria-hidden="true">{SUPPORT_ICON[topic.support]} </span>{t(`support.${topic.support}` as MessageKey)}</span>
            <p>{t(`topic.${topic.id}.how` as MessageKey)}</p>
            {topic.examples.length > 0 && (
              <div className="level-examples">
                {topic.examples.map(ex => (
                  <button
                    key={ex}
                    type="button"
                    className="level-example"
                    onClick={() => onTry?.(ex)}
                    title={t('levels.tryExample')}
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
