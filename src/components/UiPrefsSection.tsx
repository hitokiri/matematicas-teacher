import { FONT_SCALES, type UiPrefs } from '../lib/uiPrefs'

const FONT_LABELS = ['Chica', 'Normal', 'Grande', 'Muy grande']

interface UiPrefsSectionProps {
  prefs: UiPrefs
  onChange: (prefs: UiPrefs) => void
  theme?: 'light' | 'dark'
  onThemeChange?: (theme: 'light' | 'dark') => void
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
}

/** Configuracion de como se ve la app: pizarras, reproduccion, panel de temas y tema */
export default function UiPrefsSection({ prefs, onChange, theme, onThemeChange }: UiPrefsSectionProps) {
  const set = <K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) => onChange({ ...prefs, [key]: value })
  return (
    <div className="provider-section">
      <h2>🎨 Interfaz</h2>
      <div className="ui-prefs">
        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>Pizarras de un proceso largo</strong>
            <small>Una a la vez ahorra espacio; los botones "Pizarra N" cambian de pizarra.</small>
          </div>
          <div className="segmented" role="group" aria-label="Pizarras de un proceso largo">
            <button type="button" aria-pressed={prefs.boards === 'one'} onClick={() => set('boards', 'one')}>📄 Una a la vez</button>
            <button type="button" aria-pressed={prefs.boards === 'all'} onClick={() => set('boards', 'all')}>🗂 Todas juntas</button>
          </div>
        </div>

        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>Tamaño de letra</strong>
            <small>De la pizarra y de lo que explica la maestra. También con A− / A+ junto a la pizarra.</small>
          </div>
          <div className="segmented" role="group" aria-label="Tamaño de letra">
            {FONT_SCALES.map((f, i) => (
              <button
                key={f}
                type="button"
                aria-pressed={prefs.fontScale === f}
                onClick={() => set('fontScale', f)}
                style={{ fontSize: `${0.8 * f}rem` }}
              >
                {FONT_LABELS[i]}
              </button>
            ))}
          </div>
        </div>

        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>Reproducir la pizarra sola</strong>
            <small>Al resolver, la maestra avanza sola paso a paso.</small>
          </div>
          <Switch checked={prefs.autoPlay} onChange={v => set('autoPlay', v)} label="Reproducir la pizarra sola" />
        </div>

        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>Mostrar "¿Hasta dónde llega la maestra?"</strong>
            <small>El panel con los temas que la app sabe explicar.</small>
          </div>
          <Switch checked={prefs.showLevels} onChange={v => set('showLevels', v)} label="Mostrar hasta dónde llega la maestra" />
        </div>

        {theme && onThemeChange && (
          <div className="ui-pref">
            <div className="ui-pref-text">
              <strong>Tema</strong>
              <small>También se cambia con el botón redondo de abajo.</small>
            </div>
            <div className="segmented" role="group" aria-label="Tema">
              <button type="button" aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')}>☀️ Claro</button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')}>🌙 Oscuro</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
