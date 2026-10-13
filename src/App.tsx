import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import MainApp from './pages/MainApp'
import Settings from './pages/Settings'
import Modal from './components/Modal'
import { loadUiPrefs, saveUiPrefs, type UiPrefs } from './lib/uiPrefs'
import { useI18n } from './lib/i18n'

export interface AppSettings {
  active_model_id: string | null
}

type Theme = 'light' | 'dark'

/** Tema guardado; si nunca se ha escogido, el del sistema */
function initialTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'dark' || saved === 'light') return saved
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const { lang, setLang, t } = useI18n()
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AppSettings>({
    active_model_id: null,
  })
  const [isLoaded, setIsLoaded] = useState(false)
  const [uiPrefs, setUiPrefs] = useState<UiPrefs>(loadUiPrefs)
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    document.title = t('app.title')
  }, [t])

  useEffect(() => {
    saveUiPrefs(uiPrefs)
  }, [uiPrefs])

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const s = await invoke<AppSettings>('get_settings')
      setSettings(s)
      setIsLoaded(true)
    } catch (e) {
      console.error('Error loading settings:', e)
      setIsLoaded(true)
    }
  }

  // El modelo activo se guarda al seleccionarlo; al cerrar se recarga para la pantalla principal
  function closeSettings() {
    setShowSettings(false)
    void loadSettings()
  }

  function toggleTheme() {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  if (!isLoaded) {
    return <div className="loading" role="status"><div className="spinner" aria-hidden="true"></div>{t('app.loading')}</div>
  }

  const other = lang === 'es' ? 'en' : 'es'

  return (
    <div className="app">
      <a className="skip-link" href="#contenido" onClick={e => { e.preventDefault(); document.getElementById('contenido')?.focus() }}>
        {t('app.skip')}
      </a>
      <header className="header">
        <h1><img className="header-logo" src="/icon.svg" alt="" /> {t('app.title')}</h1>
        <div className="header-actions">
          <button
            className="btn btn-secondary lang-switch"
            onClick={() => setLang(other)}
            aria-label={t('app.langSwitch', { language: t(`lang.${other}`) })}
            title={t(`lang.${other}`)}
            lang={other}
          >
            <span aria-hidden="true">🌐</span> {other.toUpperCase()}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            <span aria-hidden="true">⚙️</span> {t('app.settings')}
          </button>
        </div>
      </header>

      <main className="main-content" id="contenido" tabIndex={-1}>
        <div className="main-container">
          <MainApp settings={settings} uiPrefs={uiPrefs} onUiPrefsChange={setUiPrefs} />
        </div>
      </main>

      <button
        className="theme-toggle"
        onClick={toggleTheme}
        title={theme === 'light' ? t('app.themeToDark') : t('app.themeToLight')}
        aria-label={theme === 'light' ? t('app.themeToDark') : t('app.themeToLight')}
      >
        <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
      </button>

      {showSettings && (
        <Modal labelledBy="settings-title" onClose={closeSettings}>
          <Settings
            onCancel={closeSettings}
            uiPrefs={uiPrefs}
            onUiPrefsChange={setUiPrefs}
            theme={theme}
            onThemeChange={setTheme}
          />
        </Modal>
      )}
    </div>
  )
}

export default App
