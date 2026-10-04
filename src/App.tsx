import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import MainApp from './pages/MainApp'
import Settings from './pages/Settings'

export interface AppSettings {
  provider: 'local' | 'openai' | 'anthropic'
  openai_key: string
  anthropic_key: string
  active_model_id: string | null
}

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AppSettings>({
    provider: 'local',
    openai_key: '',
    anthropic_key: '',
    active_model_id: null,
  })
  const [isLoaded, setIsLoaded] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'dark' ? 'dark' : 'light') as 'light' | 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

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

  async function saveSettings(newSettings: AppSettings) {
    try {
      await invoke('save_settings', {
        provider: newSettings.provider,
        openaiKey: newSettings.openai_key,
        anthropicKey: newSettings.anthropic_key,
        activeModelId: newSettings.active_model_id,
      })
      setSettings(newSettings)
      setShowSettings(false)
    } catch (e) {
      console.error('Error saving settings:', e)
    }
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
          <MainApp settings={settings} />
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
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <Settings 
              settings={settings}
              onSave={saveSettings}
              onCancel={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
