import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Load Tauri mock for E2E testing
if (import.meta.env.VITE_E2E_TEST) {
  console.log('[E2E] Loading Tauri mock...')
  void import('../e2e/tauri-mock.ts').then(() => {
    console.log('[E2E] Tauri mock loaded successfully')
  }).catch((err) => {
    console.error('[E2E] Failed to load Tauri mock:', err)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
