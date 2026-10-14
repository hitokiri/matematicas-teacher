import { useCallback, useMemo, useState } from 'react'
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
import { detectLang, rich, translate, useI18n, type Lang } from '../lib/i18n'

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
export function boardFor(text: string, lang: Lang = 'es'): BoardScript | null {
  const arithmetic = parseArithmetic(text)
  if (arithmetic) return buildArithmetic(arithmetic, lang)
  const expression = parseExpression(text)
  if (expression) return expressionScript(expression, text.trim(), lang)
  const system = parseSystem(text)
  if (system) return systemScript(system, lang)
  const equation = parseEquation(text)
  if (equation) return equationScript(equation, lang)
  const twoVars = parseTwoVarEquation(text)
  if (twoVars) return twoVarScript(twoVars, lang)
  const fractions = parseFractions(text)
  return fractions ? fractionScript(fractions, lang) : null
}

/** De donde sale la pizarra: la pizarra se vuelve a armar si cambia el idioma */
type BoardSource = { text: string } | { result: Solution }

function buildBoard(source: BoardSource, lang: Lang): BoardScript | null {
  if ('text' in source) return boardFor(source.text, lang)
  return boardFor(source.result.problem, lang) ?? solutionScript(source.result, lang)
}

/** Dos signos seguidos ("+*") suelen ser un error al escribir: mejor preguntar que adivinar */
export function typoHint(text: string, lang: Lang = detectLang()): string | null {
  const m = text.match(/([+\-×*÷/:])\s*([+×*÷/:])/)
  if (!m) return null
  return translate(lang, 'main.typo', { signs: `${m[1]}${m[2]}` })
}

function MainApp({ settings, uiPrefs = DEFAULT_UI_PREFS, onUiPrefsChange }: MainAppProps) {
  const { t, lang } = useI18n()
  const [problemText, setProblemText] = useState('')
  const [solution, setSolution] = useState<Solution | null>(null)
  const [source, setSource] = useState<BoardSource | null>(null)
  const board = useMemo(() => (source ? buildBoard(source, lang) : null), [source, lang])
  // Cada problema nuevo monta una pizarra nueva (empieza en el paso 1)
  const [boardKey, setBoardKey] = useState(0)
  const showBoard = (next: BoardSource) => {
    setBoardKey(k => k + 1)
    setSource(next)
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
    setDraft(d => ({ text: t('chat.draft', { n: step + 1 }), nonce: (d?.nonce ?? 0) + 1 }))
  }, [t])

  const hasInput = inputMode === 'draw' ? !!problemImage : !!problemText.trim()

  /** Resuelve un problema en texto: la app si es una cuenta o expresion, si no el modelo */
  async function solveText(text: string) {
    setError('')
    setSolution(null)
    setSource(null)

    const typo = typoHint(text, lang)
    if (typo) {
      setError(typo)
      return
    }

    // Las cuentas y expresiones numericas las resuelve la app en la pizarra, al instante
    if (boardFor(text, lang)) {
      showBoard({ text })
      return
    }

    setLoading(true)
    setLoadingMessage(t('main.thinking'))
    try {
      const result = await invoke<Solution>('solve_problem', { problemText: text.trim(), problemImage: null, language: lang })
      const read = boardFor(result.problem, lang)
      showBoard({ result })
      if (!read) setSolution(result)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e?.message || t('main.errSolve'))
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
    setSource(null)
    setReadText(null)
    setLoading(true)
    setLoadingMessage(`👀 ${t('main.reading')}`)
    let text: string
    try {
      text = await invoke<string>('read_problem', { problemImage })
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e?.message || t('main.errRead'))
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
        <h2>{t('main.heading')}</h2>

        <div className="tab-bar" role="group" aria-label={t('main.modeGroup')}>
          <button
            className={`tab ${inputMode === 'text' ? 'active' : ''}`}
            aria-pressed={inputMode === 'text'}
            onClick={() => { setError(''); setInputMode('text') }}
          >
            <span aria-hidden="true">✏️</span> {t('main.modeText')}
          </button>
          <button
            className={`tab ${inputMode === 'draw' ? 'active' : ''}`}
            aria-pressed={inputMode === 'draw'}
            onClick={() => { setProblemImage(''); setReadText(null); setError(''); setInputMode('draw') }}
          >
            <span aria-hidden="true">🎨</span> {t('main.modeDraw')}
          </button>
        </div>

        {inputMode === 'text' ? (
          <textarea
            className="problem-input"
            aria-label={t('main.problemLabel')}
            maxLength={4000}
            placeholder={t('main.placeholder')}
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
            <span aria-hidden="true">{loading ? '⏳' : '🚀'}</span> {loading ? t('main.solving') : t('main.solve')}
          </button>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <small className="error-hint">{t('main.errorHint')}</small>
          </div>
        )}

        {inputMode === 'draw' && readText !== null && !loading && (
          <div className="read-box">
            <label htmlFor="read-text"><span aria-hidden="true">👀</span> {t('main.readLabel')}</label>
            <div className="read-row">
              <input
                id="read-text"
                className="read-input"
                value={readText}
                maxLength={4000}
                onChange={(e) => setReadText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void solveText(readText) }}
              />
              <button className="btn btn-secondary" onClick={() => solveText(readText)} disabled={!readText.trim()}>
                <span aria-hidden="true">🔁</span> {t('main.readAgain')}
              </button>
            </div>
            <small>{t('main.readHint')}</small>
          </div>
        )}

        {!settings.active_model_id && (
          <div className="warning-message">{rich(t('main.noModel'))}</div>
        )}
      </div>

      {uiPrefs.showLevels && (
        <LevelsPanel onTry={ex => { setInputMode('text'); setProblemText(ex); setError('') }} />
      )}

      {loading && (
        <div className="loading" role="status">
          <div className="spinner" aria-hidden="true"></div>
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
          voiceId={lang === 'en' ? uiPrefs.voiceEn : uiPrefs.voice}
          readAloud={uiPrefs.readAloud}
          onReadAloudChange={onUiPrefsChange ? on => onUiPrefsChange({ ...uiPrefs, readAloud: on }) : undefined}
          onStepChange={setViewStep}
          onAskStep={askStep}
        />
      )}

      {solution && !loading && (
        <details className="text-explanation">
          <summary><span aria-hidden="true">📄</span> {t('main.textExplanation')}</summary>
          <SolutionDisplay solution={solution} />
        </details>
      )}
    </div>
    {board && !loading && <StepChat
      key={boardKey}
      script={board}
      currentStep={viewStep}
      draft={draft}
      voiceId={lang === 'en' ? uiPrefs.voiceEn : uiPrefs.voice}
      readAloud={uiPrefs.readAloud}
    />}
    </div>
  )
}

export default MainApp
