import { FONT_SCALES, type UiPrefs } from '../lib/uiPrefs'
import { LANGS, useI18n } from '../lib/i18n'
import Switch from './Switch'

interface UiPrefsSectionProps {
  prefs: UiPrefs
  onChange: (prefs: UiPrefs) => void
  theme?: 'light' | 'dark'
  onThemeChange?: (theme: 'light' | 'dark') => void
}

/** Configuracion de como se ve la app: idioma, pizarras, reproduccion, panel de temas y tema */
export default function UiPrefsSection({ prefs, onChange, theme, onThemeChange }: UiPrefsSectionProps) {
  const { lang, setLang, t } = useI18n()
  const set = <K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) => onChange({ ...prefs, [key]: value })
  const fontLabels = t('ui.fontSizes').split('|')
  return (
    <div className="provider-section">
      <h2><span aria-hidden="true">🎨</span> {t('ui.title')}</h2>
      <div className="ui-prefs">
        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>{t('ui.language')}</strong>
            <small>{t('ui.languageHelp')}</small>
          </div>
          <div className="segmented" role="group" aria-label={t('ui.language')}>
            {LANGS.map(l => (
              <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {t(`lang.${l}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>{t('ui.boards')}</strong>
            <small>{t('ui.boardsHelp')}</small>
          </div>
          <div className="segmented" role="group" aria-label={t('ui.boards')}>
            <button type="button" aria-pressed={prefs.boards === 'one'} onClick={() => set('boards', 'one')}>
              <span aria-hidden="true">📄</span> {t('ui.boardsOne')}
            </button>
            <button type="button" aria-pressed={prefs.boards === 'all'} onClick={() => set('boards', 'all')}>
              <span aria-hidden="true">🗂</span> {t('ui.boardsAll')}
            </button>
          </div>
        </div>

        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>{t('ui.font')}</strong>
            <small>{t('ui.fontHelp')}</small>
          </div>
          <div className="segmented" role="group" aria-label={t('ui.font')}>
            {FONT_SCALES.map((f, i) => (
              <button
                key={f}
                type="button"
                aria-pressed={prefs.fontScale === f}
                onClick={() => set('fontScale', f)}
                style={{ fontSize: `${0.8 * f}rem` }}
              >
                {fontLabels[i]}
              </button>
            ))}
          </div>
        </div>

        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>{t('ui.autoPlay')}</strong>
            <small>{t('ui.autoPlayHelp')}</small>
          </div>
          <Switch checked={prefs.autoPlay} onChange={v => set('autoPlay', v)} label={t('ui.autoPlay')} />
        </div>

        <div className="ui-pref">
          <div className="ui-pref-text">
            <strong>{t('ui.showLevels')}</strong>
            <small>{t('ui.showLevelsHelp')}</small>
          </div>
          <Switch checked={prefs.showLevels} onChange={v => set('showLevels', v)} label={t('ui.showLevels')} />
        </div>

        {theme && onThemeChange && (
          <div className="ui-pref">
            <div className="ui-pref-text">
              <strong>{t('ui.theme')}</strong>
              <small>{t('ui.themeHelp')}</small>
            </div>
            <div className="segmented" role="group" aria-label={t('ui.theme')}>
              <button type="button" aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')}><span aria-hidden="true">☀️</span> {t('ui.themeLight')}</button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')}><span aria-hidden="true">🌙</span> {t('ui.themeDark')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
