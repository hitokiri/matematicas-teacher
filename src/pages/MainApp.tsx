import { useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import DrawingCanvas from '../components/DrawingCanvas'
import SolutionDisplay from '../components/SolutionDisplay'
import Chalkboard from '../components/Chalkboard'
import StepChat from '../components/StepChat'
import LevelsPanel from '../components/LevelsPanel'
import { DEFAULT_UI_PREFS, type UiPrefs } from '../lib/uiPrefs'
import { parseArithmetic } from '../lib/board/parse'
import { buildArithmetic } from '../lib/board/arithmetic'
import { solutionScript } from '../lib/board/fromSolution'
import { expressionScript, parseExpression } from '../lib/board/expression'
import { equationScript, parseEquation } from '../lib/board/equation'
import { parseTwoVarEquation, twoVarScript } from '../lib/board/twoVars'
import { parseSystem, systemScript } from '../lib/board/system'
import { fractionScript, parseFractions } from '../lib/board/fraction'
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
  uiPrefs?: UiPrefs
  onUiPrefsChange?: (prefs: UiPrefs) => void
}

/** Pizarra que la app resuelve sola: cuentas en columna, expresiones (orden de operaciones, raices)
 *  ecuaciones de primer grado con balanza, sistemas de dos ecuaciones y fracciones con pizzas */
export function boardFor(text: string): BoardScript | null {
  const arithmetic = parseArithmetic(text)
  if (arithmetic) return buildArithmetic(arithmetic)
  const expression = parseExpression(text)
  if (expression) return expressionScript(expression, text.trim())
  const system = parseSystem(text)
  if (system) return systemScript(system)
  const equation = parseEquation(text)
  if (equation) return equationScript(equation)
  const twoVars = parseTwoVarEquation(text)
  if (twoVars) return twoVarScript(twoVars)
  const fractions = parseFractions(text)
  return fractions ? fractionScript(fractions) : null
}

/** Dos signos seguidos ("+*") suelen ser un error al escribir: mejor preguntar que adivinar */
export function typoHint(text: string): string | null {
  const m = text.match(/([+\-×*÷/:])\s*([+×*÷/:])/)
  if (!m) return null
  return `Hay dos signos seguidos ("${m[1]}${m[2]}"). Revisa qué querías escribir y quita uno.`
}

function MainApp({ settings, uiPrefs = DEFAULT_UI_PREFS, onUiPrefsChange }: MainAppProps) {
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
  // Lo que el modelo leyo en el dibujo (editable por si leyo mal un numero)
  const [readText, setReadText] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('')
  // Chat de preguntas: paso que se ve en la pizarra y pregunta preparada al pulsar un numero
  const [viewStep, setViewStep] = useState(0)
  const [draft, setDraft] = useState<{ text: string; nonce: number } | null>(null)
  const askStep = useCallback((step: number) => {
    setDraft(d => ({ text: `Tengo una duda con el paso ${step + 1}: `, nonce: (d?.nonce ?? 0) + 1 }))
  }, [])

  const hasInput = inputMode === 'draw' ? !!problemImage : !!problemText.trim()

  /** Resuelve un problema en texto: la app si es una cuenta o expresion, si no el modelo */
  async function solveText(text: string) {
    setError('')
    setSolution(null)
    setBoard(null)

    const typo = typoHint(text)
    if (typo) {
      setError(typo)
      return
    }

    // Las cuentas y expresiones numericas las resuelve la app en la pizarra, al instante
    const own = boardFor(text)
    if (own) {
      showBoard(own)
      return
    }

    setLoading(true)
    setLoadingMessage('La maestra está pensando la explicación...')
    try {
      const result = await invoke<Solution>('solve_problem', { problemText: text.trim(), problemImage: null })
      const read = boardFor(result.problem)
      showBoard(read ?? solutionScript(result))
      if (!read) setSolution(result)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e?.message || 'Error al resolver el problema')
    } finally {
      setLoading(false)
    }
  }

  async function solveProblem() {
    if (!hasInput) return
    if (inputMode === 'text') return solveText(problemText)

    // Dibujo: primero el modelo solo lo lee; se muestra lo que leyo para poder corregirlo
    setError('')
    setSolution(null)
    setBoard(null)
    setReadText(null)
    setLoading(true)
    setLoadingMessage('👀 Leyendo tu dibujo...')
    let text: string
    try {
      text = await invoke<string>('read_problem', { problemImage })
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e?.message || 'No pude leer el dibujo')
      setLoading(false)
      return
    }
    setLoading(false)
    setReadText(text)
    await solveText(text)
  }

  function handleCanvasDraw(image: string) {
    setProblemImage(image)
    setError('')
  }

  return (
    <div className={`workspace ${board && !loading ? 'with-chat' : ''}`}>
    <div className="workspace-main">
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
            onClick={() => { setProblemImage(''); setReadText(null); setError(''); setInputMode('draw') }}
          >
            🎨 Dibujar
          </button>
        </div>

        {inputMode === 'text' ? (
          <textarea
            className="problem-input"
            placeholder="Ejemplo: 2 + 2 = ?&#10;o&#10;x + 5 = 12&#10;o un sistema, una ecuación por renglón:&#10;x + y = 5&#10;x - y = 1"
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

        {inputMode === 'draw' && readText !== null && !loading && (
          <div className="read-box">
            <label htmlFor="read-text">👀 Leí esto en tu dibujo:</label>
            <div className="read-row">
              <input
                id="read-text"
                className="read-input"
                value={readText}
                onChange={(e) => setReadText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void solveText(readText) }}
              />
              <button className="btn btn-secondary" onClick={() => solveText(readText)} disabled={!readText.trim()}>
                🔁 Resolver esto
              </button>
            </div>
            <small>¿Leí mal algún número? Corrígelo aquí (por ejemplo una x que era un 7) y vuelve a resolver.</small>
          </div>
        )}

        {!settings.active_model_id && (
          <div className="warning-message">
            Las cuentas como <strong>10 x 20</strong> funcionan sin modelo. Para dibujos y otros problemas, ve a <strong>Configuracion</strong> y selecciona un modelo.
          </div>
        )}
      </div>

      {uiPrefs.showLevels && (
        <LevelsPanel onTry={ex => { setInputMode('text'); setProblemText(ex); setError('') }} />
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>{loadingMessage}</p>
        </div>
      )}

      {board && !loading && (
        <Chalkboard
          key={boardKey}
          script={board}
          autoPlay={uiPrefs.autoPlay}
          showAllPages={uiPrefs.boards === 'all'}
          fontScale={uiPrefs.fontScale}
          onFontScaleChange={onUiPrefsChange ? f => onUiPrefsChange({ ...uiPrefs, fontScale: f }) : undefined}
          onStepChange={setViewStep}
          onAskStep={askStep}
        />
      )}

      {solution && !loading && (
        <details className="text-explanation">
          <summary>📄 Ver la explicación en texto</summary>
          <SolutionDisplay solution={solution} />
        </details>
      )}
    </div>
    {board && !loading && <StepChat key={boardKey} script={board} currentStep={viewStep} draft={draft} />}
    </div>
  )
}

export default MainApp
