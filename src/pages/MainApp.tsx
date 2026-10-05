import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import DrawingCanvas from '../components/DrawingCanvas'
import SolutionDisplay from '../components/SolutionDisplay'
import Chalkboard from '../components/Chalkboard'
import { parseArithmetic } from '../lib/board/parse'
import { buildArithmetic } from '../lib/board/arithmetic'
import { solutionScript } from '../lib/board/fromSolution'
import { expressionScript, parseExpression } from '../lib/board/expression'
import type { BoardScript } from '../lib/board/types'

interface AppSettings {
  active_model_id: string | null
}

interface Solution {
  problem: string
  steps: Array<{
    step: number
    explanation: string
    title?: string | null
    calculation?: string | null
  }>
  final_answer: string
}

interface MainAppProps {
  settings: AppSettings
}

/** Pizarra que la app resuelve sola: cuentas en columna o expresiones (orden de operaciones, raices) */
function boardFor(text: string): BoardScript | null {
  const arithmetic = parseArithmetic(text)
  if (arithmetic) return buildArithmetic(arithmetic)
  const expression = parseExpression(text)
  return expression ? expressionScript(expression, text.trim()) : null
}

function MainApp({ settings }: MainAppProps) {
  const [problemText, setProblemText] = useState('')
  const [solution, setSolution] = useState<Solution | null>(null)
  const [board, setBoard] = useState<BoardScript | null>(null)
  // Cada problema nuevo monta una pizarra nueva (empieza en el paso 1)
  const [boardKey, setBoardKey] = useState(0)
  const showBoard = (script: BoardScript) => {
    setBoardKey(k => k + 1)
    setBoard(script)
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputMode, setInputMode] = useState<'text' | 'draw'>('text')
  const [problemImage, setProblemImage] = useState('')

  const hasInput = inputMode === 'draw' ? !!problemImage : !!problemText.trim()

  async function solveProblem() {
    if (!hasInput) return
    
    setError('')
    setSolution(null)
    setBoard(null)

    // Las cuentas y expresiones numericas las resuelve la app en la pizarra, al instante
    const own = inputMode === 'text' ? boardFor(problemText) : null
    if (own) {
      showBoard(own)
      return
    }

    setLoading(true)
    try {
      const result = await invoke<Solution>('solve_problem', {
        problemText: inputMode === 'text' ? problemText.trim() : '',
        problemImage: inputMode === 'draw' ? problemImage : null,
      })
      // Si el modelo leyo una cuenta en el dibujo, la pizarra la hace con el algoritmo exacto
      const read = boardFor(result.problem)
      showBoard(read ?? solutionScript(result))
      if (!read) setSolution(result)
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
            Las cuentas como <strong>10 x 20</strong> funcionan sin modelo. Para dibujos y otros problemas, ve a <strong>Configuracion</strong> y selecciona un modelo.
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>La AI esta pensando en la solucion...</p>
        </div>
      )}

      {board && !loading && <Chalkboard key={boardKey} script={board} />}

      {solution && !loading && (
        <details className="text-explanation">
          <summary>📄 Ver la explicación en texto</summary>
          <SolutionDisplay solution={solution} />
        </details>
      )}
    </>
  )
}

export default MainApp
