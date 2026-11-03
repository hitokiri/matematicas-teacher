// Modo practica: la nena dicta operaciones con la voz y la pizarra las ejecuta paso a paso.
// La intencion se resuelve con el parser determinista; si no se entiende, la maestra pregunta
// en vez de ejecutar (seguridad). La pizarra se muestra con el paso controlado desde aqui.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { notifyVoiceInterrupt, plainSpeech, speak, stopSpeaking } from '../lib/voice'
import { useSystemVoice } from '../lib/useSystemVoice'
import { claimMic, listMicModels, onMicEvents, startListening, stopListening, type MicState } from '../lib/mic'
import { pick, type Lang } from '../lib/board/lang'
import { balance, pan, showLin, type Equation } from '../lib/board/equation'
import { answerOf, applyOperation, isSolved, type EquationState } from '../lib/board/ops'
import { parseOperationIntent } from '../lib/board/intent'
import type { BoardItem, BoardScript, BoardStep } from '../lib/board/types'
import { SYSTEM_VOICE } from '../lib/voice'
import Chalkboard from './Chalkboard'
import { Mic, Square } from 'lucide-react'
import Ico from './Ico'

interface PracticeBoardProps {
  equation: Equation
  /** Voz con que habla la maestra ('system' o el id de una voz descargada) */
  voiceId?: string
  /** La maestra confirma cada operacion en voz alta */
  readAloud?: boolean
  /** Intenta resolver el transcript como problema en la pizarra; devuelve true si lo tom6 */
  onUnknown?: (text: string) => boolean
}

const initialStep = (e: Equation, lang: Lang): BoardStep => {
  const T = pick(lang)
  return {
    say: T(
      `La ecuación está en la pizarra. Dime qué operación hacemos: sumar, restar, multiplicar o dividir los dos lados.`,
      `The equation is on the board. Tell me what operation we do: add, subtract, multiply or divide both sides.`,
    ),
    add: [{ id: 'p0', kind: 'text', row: 0, col: 0, text: `${showLin(e.left, e.variable)} = ${showLin(e.right, e.variable)}`, tone: 'op', align: 'start' }],
    visual: balance(pan(e.left, e.variable), pan(e.right, e.variable)),
  }
}

export default function PracticeBoard({ equation, voiceId = SYSTEM_VOICE, readAloud = true, onUnknown }: PracticeBoardProps) {
  const { t, lang } = useI18n()
  const T = pick(lang)
  const systemVoice = useSystemVoice()
  const canSpeak = voiceId !== SYSTEM_VOICE || systemVoice.available
  const v = equation.variable

  const [state, setState] = useState<EquationState>({ left: equation.left, right: equation.right, variable: v })
  const [steps, setSteps] = useState<BoardStep[]>(() => [initialStep(equation, lang)])
  const [row, setRow] = useState(1)
  const [step, setStep] = useState(0)
  const [teacher, setTeacher] = useState('')
  const [mic, setMic] = useState<MicState>('idle')
  const [micReady, setMicReady] = useState(false)
  const [micError, setMicError] = useState('')
  const handleRef = useRef<(text: string) => void>(() => {})

  // Estable entre renders: si la pizarra recibe un guion nuevo en cada render, vuelve a leer el paso
  const script: BoardScript = useMemo(() => ({
    title: equation.text,
    cols: Math.ceil(Math.max(...steps.flatMap(s => s.add).map(i => (i.kind === 'text' ? i.text.length : 0)), 10) / 1.6) + 1,
    rows: Math.max(row, 1),
    steps,
    answer: answerOf(state) ?? '',
  }), [equation.text, steps, row, state])
  const nextStep = useCallback(() => setStep(s => Math.min(s + 1, steps.length - 1)), [steps.length])

  const sayTeacher = useCallback((text: string) => {
    setTeacher(text)
    if (readAloud && canSpeak) {
      notifyVoiceInterrupt()
      void speak(plainSpeech(text), voiceId, lang)
    }
  }, [readAloud, canSpeak, voiceId, lang])

  const handleTranscript = useCallback((text: string) => {
    const op = parseOperationIntent(text, lang)
    if (!op) {
      if (onUnknown?.(text)) return
      sayTeacher(T(
        'No entendí la operación. ¿Quieres sumar, restar, multiplicar o dividir los dos lados?',
        'I did not understand the operation. Do you want to add, subtract, multiply or divide both sides?',
      ))
      return
    }
    const r = applyOperation(state, op, lang, row, `op${steps.length}_`)
    if (!r) {
      sayTeacher(T('No se puede dividir entre 0. Prueba con otro número.', 'You cannot divide by 0. Try another number.'))
      return
    }
    const next = [...steps, ...r.steps]
    const solved = isSolved({ left: r.left, right: r.right, variable: v })
    if (solved) {
      const ans = answerOf({ left: r.left, right: r.right, variable: v })!
      next.push({ say: T(`¡Encontramos el peso de la bolsa! ${ans}. 🎉`, `We found the weight of the bag! ${ans}. 🎉`), add: [] })
    }
    setSteps(next)
    setState({ left: r.left, right: r.right, variable: v })
    setRow(row + r.steps.length)
    setTeacher('')
    setStep(steps.length)
  }, [lang, state, row, steps, v, sayTeacher, T, onUnknown])
  handleRef.current = handleTranscript

  useEffect(() => {
    Promise.resolve(listMicModels())
      .then(models => setMicReady(Array.isArray(models) && models.some(m => m.is_downloaded)))
      .catch(() => setMicReady(false))
    return onMicEvents({
      onState: setMic,
      onTranscript: text => {
        setMicError('')
        handleRef.current(text)
      },
      onError: message => setMicError(message || t('chat.micErr')),
    }, 'practice')
  }, [t])

  useEffect(() => () => { Promise.resolve(stopListening()).catch(() => {}) }, [])

  async function toggleMic() {
    setMicError('')
    if (mic === 'recording') {
      Promise.resolve(stopListening()).catch(() => {})
      return
    }
    if (mic === 'transcribing') return
    const ready = micReady
      || await Promise.resolve(listMicModels())
        .then(models => Array.isArray(models) && models.some(m => m.is_downloaded))
        .catch(() => false)
    if (!ready) {
      setMicError(t('chat.micNeedModel'))
      return
    }
    if (!micReady) setMicReady(true)
    stopSpeaking()
    notifyVoiceInterrupt()
    try {
      claimMic('practice')
      await startListening(lang)
    } catch (e: any) {
      setMicError(typeof e === 'string' ? e : e?.message || t('chat.micErr'))
    }
  }

  return (
    <aside className="step-chat" aria-label={t('practice.title')}>
      <div className="step-chat-header">
        <Ico as={Mic} />
        <div>
          <h3>{t('practice.title')}</h3>
          <small>{t('practice.hint')}</small>
        </div>
      </div>

      <div className="step-chat-messages" role="log" aria-live="polite">
        {teacher && <div className="chat-msg assistant"><span className="chat-avatar" aria-hidden="true">👩‍🏫</span><div className="chat-bubble"><p>{teacher}</p></div></div>}
        {(micError) && <div className="error-message" role="alert">{micError}</div>}
      </div>

      <div className="step-chat-form">
        <button
          type="button"
          className={`btn btn-secondary chat-mic chat-mic-${mic}`}
          onClick={() => void toggleMic()}
          disabled={mic === 'transcribing'}
          aria-pressed={mic === 'recording'}
          aria-label={mic === 'recording' ? t('chat.micStop') : t('chat.mic')}
          title={mic === 'recording' ? t('chat.micStop') : t('chat.mic')}
        >
          {mic === 'recording' ? <Ico as={Square} /> : mic === 'transcribing' ? <span aria-hidden="true">…</span> : <Ico as={Mic} />}
        </button>
      </div>
      {(mic === 'recording' || mic === 'transcribing') && (
        <p className="chat-mic-status" role="status">
          {mic === 'recording' ? t('chat.micRecording') : t('chat.micBusy')}
        </p>
      )}

      <Chalkboard
        script={script}
        step={step}
        onStepDone={nextStep}
        onStepMove={setStep}
        voiceId={voiceId}
        readAloud={readAloud}
      />
    </aside>
  )
}
