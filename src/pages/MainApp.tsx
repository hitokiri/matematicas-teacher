import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import DrawingCanvas from '../components/DrawingCanvas'
import SolutionDisplay from '../components/SolutionDisplay'

interface AppSettings {
  active_model_id: string | null
}

interface Solution {
  problem: string
  steps: Array<{
    step: number
    explanation: string
    calculation: string
  }>
  final_answer: string
}

interface MainAppProps {
  settings: AppSettings
}

function MainApp({ settings }: MainAppProps) {
  const [problemText, setProblemText] = useState('')
  const [solution, setSolution] = useState<Solution | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputMode, setInputMode] = useState<'text' | 'draw'>('text')
  const [problemImage, setProblemImage] = useState('')

  const hasInput = inputMode === 'draw' ? !!problemImage : !!problemText.trim()

  async function solveProblem() {
    if (!hasInput) return
    
    setLoading(true)
    setError('')
    setSolution(null)

    try {
      const result = await invoke<Solution>('solve_problem', {
        problemText: inputMode === 'text' ? problemText.trim() : '',
        problemImage: inputMode === 'draw' ? problemImage : null,
      })
      setSolution(result)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e?.message || 'Error al resolver el problema')
    } finally {
      setLoading(false)
    }
  }

  function handleCanvasDraw(image: string) {
    setProblemImage(image)
    setError('')
  }

  return (
    <>
      <div className="input-section">
        <h2>Escribe o dibuja tu problema matematico</h2>
        
        <div className="tab-bar">
          <button 
            className={`tab ${inputMode === 'text' ? 'active' : ''}`}
            onClick={() => { setError(''); setInputMode('text') }}
          >
            ✏️ Texto
          </button>
          <button 
            className={`tab ${inputMode === 'draw' ? 'active' : ''}`}
            onClick={() => { setProblemImage(''); setError(''); setInputMode('draw') }}
          >
            🎨 Dibujar
          </button>
        </div>

        {inputMode === 'text' ? (
          <textarea
            className="problem-input"
            placeholder="Ejemplo: 2 + 2 = ?&#10;o&#10;x + 5 = 12&#10;o&#10;1/2 + 1/4 = ?"
            value={problemText}
            onChange={(e) => { setProblemText(e.target.value); setError('') }}
          />
        ) : (
          <DrawingCanvas onDraw={handleCanvasDraw} />
        )}

        <div className="solve-section">
          <button 
            className="btn btn-primary btn-large"
            onClick={solveProblem}
            disabled={loading || !hasInput}
          >
            {loading ? '⏳ Resolviendo...' : '🚀 Resolver Problema'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!settings.active_model_id && (
          <div className="warning-message">
            No tienes un modelo configurado. Ve a <strong>Configuracion</strong> para descargar y seleccionar uno.
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>La AI esta pensando en la solucion...</p>
        </div>
      )}

      {solution && !loading && (
        <SolutionDisplay solution={solution} />
      )}
    </>
  )
}

export default MainApp
