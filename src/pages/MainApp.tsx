import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import DrawingCanvas from '../components/DrawingCanvas'
import SolutionDisplay from '../components/SolutionDisplay'
import Chalkboard from '../components/Chalkboard'
import StepChat from '../components/StepChat'
import MathKeypad from '../components/MathKeypad'
import { useMic } from '../lib/useMic'
import PracticeBoard from '../components/PracticeBoard'
import LevelsPanel from '../components/LevelsPanel'
import { exampleFromChat } from '../lib/board/example'
import { notifyVoiceInterrupt } from '../lib/voice'
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
import { Brain, Calculator, Eye, FileText, Hourglass, Mic, NotebookPen, Palette, Pencil, RotateCw, Sparkles, Square } from 'lucide-react'
import Ico from '../components/Ico'

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
  /** Abre Ajustes (para elegir un modelo desde los avisos) */
  onOpenSettings?: () => void
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

function MainApp({ settings, uiPrefs = DEFAULT_UI_PREFS, onUiPrefsChange, onOpenSettings }: MainAppProps) {
  const { t, lang } = useI18n()
  const [problemText, setProblemText] = useState('')
  const [solution, setSolution] = useState<Solution | null>(null)
  const [source, setSource] = useState<BoardSource | null>(null)
  const board = useMemo(() => (source ? buildBoard(source, lang) : null), [source, lang])
  // Cada problema nuevo monta una pizarra nueva (empieza en el paso 1)
  const [boardKey, setBoardKey] = useState(0)
  // Ejemplo que el nino pidio en el chat y que se ve en otra pizarra, sin tocar la principal
  const [aside, setAside] = useState<{ text: string; nonce: number } | null>(null)
  const asideBoard = useMemo(() => (aside ? boardFor(aside.text, lang) : null), [aside, lang])
  const showBoard = (next: BoardSource) => {
    setAside(null)
    setEditing(false)
    setBoardKey(k => k + 1)
    setSource(next)
  }
  // Con pizarra la entrada se reduce a una barra; "Nuevo problema" la vuelve a abrir
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputMode, setInputMode] = useState<'text' | 'draw'>('text')
  const [practice, setPractice] = useState(false)
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

  // Herramientas junto a la caja de texto: simbolos para quien no los encuentra en el teclado y dictado por voz
  const problemRef = useRef<HTMLTextAreaElement>(null)
  const keypadToggle = useRef<HTMLButtonElement>(null)
  const keypadId = useId()
  const solveHintId = useId()
  const [keypad, setKeypad] = useState(false)
  const insertAtCursor = (symbol: string) => {
    const el = problemRef.current
    const start = el?.selectionStart ?? problemText.length
    const end = el?.selectionEnd ?? problemText.length
    setProblemText(problemText.slice(0, start) + symbol + problemText.slice(end))
    setError('')
    // el cursor queda despues del simbolo y el foco no sale de la caja
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + symbol.length, start + symbol.length)
    })
  }
  const dictation = useMic('problem', text => {
    setProblemText(current => (current.trim() ? `${current.trimEnd()} ${text}` : text))
    setError('')
    problemRef.current?.focus()
  })
  const closeKeypad = () => { setKeypad(false); keypadToggle.current?.focus() }

  const openInput = () => {
    setEditing(true)
    requestAnimationFrame(() => problemRef.current?.focus())
  }

  const hasInput = inputMode === 'draw' ? !!problemImage : !!problemText.trim()
  const practiceEquation = source ? parseEquation('text' in source ? source.text : source.result.problem) : null

  /** El problema que la app puede resolver dentro de una pregunta del chat (si no es el mismo de la pizarra) */
  const exampleOf = useCallback((question: string, history: Array<{ role: 'user' | 'assistant'; content: string }>): string | null => {
    const found = exampleFromChat(question, history, text => !!boardFor(text, lang))
    const compact = (x: string) => x.replace(/\s+/g, '')
    return found && board && compact(found) !== compact(board.title) ? found : null
  }, [lang, board])

  /** Ejemplo escrito por la maestra: solo si la pizarra lo resuelve y no es el problema que ya se ve */
  const canShow = useCallback((problem: string): string | null => {
    const compact = (x: string) => x.replace(/\s+/g, '')
    return boardFor(problem, lang) && !(board && compact(problem) === compact(board.title)) ? problem : null
  }, [lang, board])

  const showExample = (text: string, where: 'replace' | 'aside') => {
    if (where === 'replace') {
      void solveText(text)
      return
    }
    notifyVoiceInterrupt() // la pizarra principal se pausa para que se oiga el ejemplo
    setAside(a => ({ text, nonce: (a?.nonce ?? 0) + 1 }))
  }

  /** Lo que se dicta primero es un problema: si la app lo resuelve sola, va a la pizarra */
  const handleTranscript = useCallback((text: string): boolean => {
    const t = text.trim()
    if (!t) return false
    if (boardFor(t, lang)) {
      void solveText(t)
      return true
    }
    return false
  }, [lang])

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

    if (!settings.active_model_id) {
      setError(t('main.errNoModel'))
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
    if (!settings.active_model_id) {
      setError(t('main.errNoModel'))
      return
    }
    setError('')
    setSolution(null)
    setSource(null)
    setReadText(null)
    setLoading(true)
    setLoadingMessage(t('main.reading'))
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

  const noModelError = !settings.active_model_id && error === t('main.errNoModel')
  const pickModelButton = onOpenSettings && (
    <button type="button" className="btn btn-primary" onClick={onOpenSettings}>
      <Ico as={Brain} /> {t('main.pickModel')}
    </button>
  )
  // Con la pizarra a la vista el panel va debajo de ella, para que la pizarra no quede lejos
  const levelsPanel = (
    <LevelsPanel onTry={ex => { setEditing(true); setInputMode('text'); setProblemText(ex); setError(''); requestAnimationFrame(() => problemRef.current?.focus()) }} />
  )
  const collapsed = !!board && !loading && !editing
  const practiceChip = practiceEquation && (
    <div className="solve-section">
      <button className={`chip ${practice ? 'active' : ''}`} onClick={() => setPractice(p => !p)}>
        <Ico as={Mic} /> {t('practice.mode')}
      </button>
    </div>
  )

  return (
    <div className={`workspace ${board && !loading ? 'with-chat' : ''}`}>
    <div className="workspace-main">
      <div className={`input-section ${collapsed ? 'collapsed' : ''}`}>
        {collapsed && board && (
          <div className="problem-bar" role="group" aria-label={t('main.currentProblem')}>
            <h2 className="problem-bar-text" title={board.title}>{board.title}</h2>
            {practiceChip}
            <button type="button" className="btn btn-secondary" onClick={openInput}>
              <Ico as={Pencil} /> {t('main.newProblem')}
            </button>
          </div>
        )}
        <div hidden={collapsed}>
        <h2>{t('main.heading')}</h2>

        <div className="tab-bar" role="group" aria-label={t('main.modeGroup')}>
          <button
            className={`tab ${inputMode === 'text' ? 'active' : ''}`}
            aria-pressed={inputMode === 'text'}
            onClick={() => { setError(''); setInputMode('text') }}
          >
            <Ico as={Pencil} /> {t('main.modeText')}
          </button>
          <button
            className={`tab ${inputMode === 'draw' ? 'active' : ''}`}
            aria-pressed={inputMode === 'draw'}
            onClick={() => { setProblemImage(''); setReadText(null); setError(''); setInputMode('draw') }}
          >
            <Ico as={Palette} /> {t('main.modeDraw')}
          </button>
        </div>

        {inputMode === 'text' ? (
          <>
            <div className="problem-field">
              <textarea
                className="problem-input"
                aria-label={t('main.problemLabel')}
                ref={problemRef}
                maxLength={4000}
                placeholder={t('main.placeholder')}
                value={problemText}
                onChange={(e) => { setProblemText(e.target.value); setError('') }}
              />
              <div className="field-tools">
                <button
                  type="button"
                  className={`btn btn-secondary solve-tool chat-mic-${dictation.state}`}
                  onClick={() => void dictation.toggle()}
                  disabled={dictation.state === 'transcribing'}
                  aria-pressed={dictation.state === 'recording'}
                  aria-label={dictation.state === 'recording' ? t('main.dictateStop') : t('main.dictateLabel')}
                  title={t('main.dictateTitle')}
                >
                  {dictation.state === 'recording' ? <Ico as={Square} /> : dictation.state === 'transcribing' ? <span aria-hidden="true">…</span> : <Ico as={Mic} />}{' '}
                  <span className="tool-label">{dictation.state === 'recording' ? t('main.dictateStop') : t('main.dictate')}</span>
                </button>
                <button
                  type="button"
                  ref={keypadToggle}
                  className={`btn btn-secondary solve-tool ${keypad ? 'active' : ''}`}
                  onClick={() => setKeypad(k => !k)}
                  aria-expanded={keypad}
                  aria-controls={keypadId}
                >
                  <Ico as={Calculator} /> <span className="tool-label">{keypad ? t('keypad.close') : t('keypad.open')}</span>
                </button>
              </div>
            </div>
            {(dictation.state === 'recording' || dictation.state === 'transcribing') && (
              <p className="chat-mic-status" role="status">
                {dictation.state === 'recording' ? t('chat.micRecording') : t('chat.micBusy')}
              </p>
            )}
            {dictation.error && <div className="error-message" role="alert">{dictation.error}</div>}
            {keypad && <MathKeypad id={keypadId} onInsert={insertAtCursor} onClose={closeKeypad} />}
          </>
        ) : (
          <DrawingCanvas onDraw={handleCanvasDraw} />
        )}

        <div className="solve-section">
          <button
            className="btn btn-primary btn-large"
            onClick={solveProblem}
            disabled={loading || !hasInput}
            aria-describedby={!loading && !hasInput ? solveHintId : undefined}
          >
            <Ico as={loading ? Hourglass : Sparkles} /> {loading ? t('main.solving') : t('main.solve')}
          </button>
          {!loading && !hasInput && (
            <p id={solveHintId} className="solve-hint">
              {inputMode === 'draw' ? t('main.solveHintDraw') : t('main.solveHintText')}
            </p>
          )}
        </div>

        {practiceChip}

        {error && (
          <div className="error-message" role="alert">
            {error}
            {noModelError
              ? pickModelButton && <div className="error-action">{pickModelButton}</div>
              : <small className="error-hint">{t('main.errorHint')}</small>}
          </div>
        )}

        </div>

        {inputMode === 'draw' && readText !== null && !loading && (
          <div className="read-box">
            <label htmlFor="read-text"><Ico as={Eye} /> {t('main.readLabel')}</label>
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
                <Ico as={RotateCw} /> {t('main.readAgain')}
              </button>
            </div>
            <small>{t('main.readHint')}</small>
          </div>
        )}

        {!settings.active_model_id && !collapsed && !noModelError && (
          <div className="warning-message">
            <p>{rich(t('main.noModel'))}</p>
            {pickModelButton && <div className="error-action">{pickModelButton}</div>}
          </div>
        )}
      </div>

      {uiPrefs.showLevels && !board && levelsPanel}

      {loading && (
        <div className="loading" role="status">
          <div className="spinner" aria-hidden="true"></div>
          <p>{loadingMessage}</p>
        </div>
      )}

      {board && !loading && (practice && practiceEquation ? (
        <PracticeBoard
          key={boardKey}
          equation={practiceEquation}
          voiceId={lang === 'en' ? uiPrefs.voiceEn : uiPrefs.voice}
          readAloud={uiPrefs.readAloud}
          onUnknown={handleTranscript}
        />
      ) : (
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
      ))}

      {asideBoard && aside && !loading && (
        <section className="example-board" aria-label={t('example.title')}>
          <div className="example-board-header">
            <h3><Ico as={NotebookPen} /> {t('example.title')}</h3>
            <button type="button" className="chip" onClick={() => setAside(null)}>{t('example.close')}</button>
          </div>
          <Chalkboard
            key={aside.nonce}
            script={asideBoard}
            autoPlay
            showAllPages={uiPrefs.boards === 'all'}
            fontScale={uiPrefs.fontScale}
            voiceId={lang === 'en' ? uiPrefs.voiceEn : uiPrefs.voice}
            readAloud={uiPrefs.readAloud}
          />
        </section>
      )}

      {uiPrefs.showLevels && board && !loading && levelsPanel}

      {solution && !loading && (
        <details className="text-explanation">
          <summary><Ico as={FileText} /> {t('main.textExplanation')}</summary>
          <SolutionDisplay solution={solution} />
        </details>
      )}
    </div>
    {board && !loading && !(practice && practiceEquation) && <StepChat
      key={boardKey}
      script={board}
      currentStep={viewStep}
      draft={draft}
      voiceId={lang === 'en' ? uiPrefs.voiceEn : uiPrefs.voice}
      readAloud={uiPrefs.readAloud}
      exampleOf={exampleOf}
      canShow={canShow}
      onExample={showExample}
    />}
    </div>
  )
}

export default MainApp
