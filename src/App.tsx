import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import MainApp from './pages/MainApp'
import Settings from './pages/Settings'
import { loadUiPrefs, saveUiPrefs, type UiPrefs } from './lib/uiPrefs'

export interface AppSettings {
  active_model_id: string | null
}

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AppSettings>({
    active_model_id: null,
  })
  const [isLoaded, setIsLoaded] = useState(false)
  const [uiPrefs, setUiPrefs] = useState<UiPrefs>(loadUiPrefs)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'dark' ? 'dark' : 'light') as 'light' | 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    saveUiPrefs(uiPrefs)
  }, [uiPrefs])

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      console.log('[App] Calling get_settings...');
      const s = await invoke<AppSettings>('get_settings')
      console.log('[App] Settings loaded:', s);
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
    return <div className="loading"><div className="spinner"></div>Cargando...</div>
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📐 Matematicas Teacher</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            ⚙️ Configuracion
          </button>
        </div>
      </header>
      
      <main className="main-content">
        <div className="main-container">
          <MainApp settings={settings} uiPrefs={uiPrefs} onUiPrefsChange={setUiPrefs} />
        </div>
      </main>

      <button 
        className="theme-toggle" 
        onClick={toggleTheme}
        title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {showSettings && (
        <div className="modal-overlay" onClick={closeSettings}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <Settings
              onCancel={closeSettings}
              uiPrefs={uiPrefs}
              onUiPrefsChange={setUiPrefs}
              theme={theme}
              onThemeChange={setTheme}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
