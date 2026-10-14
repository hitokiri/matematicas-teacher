import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from '../lib/i18n'
import { logUi } from '../lib/applog'
import { SYSTEM_VOICE, notifyVoiceInterrupt, plainSpeech, speak, stopSpeaking } from '../lib/voice'
import { useSystemVoice } from '../lib/useSystemVoice'
import type { BoardScript } from '../lib/board/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface StepChatProps {
  script: BoardScript
  /** Paso que se esta viendo en la pizarra (0 = primero) */
  currentStep: number
  /** Pregunta preparada al pulsar el numero de un paso; cambia `nonce` para repetirla */
  draft?: { text: string; nonce: number } | null
  /** Voz con que se leen las respuestas ('system' o el id de una voz descargada) */
  voiceId?: string
  /** Leer en voz alta cada respuesta de la maestra (nunca lo que escribe el nino) */
  readAloud?: boolean
}

/** Lo que la maestra sabe de la pizarra: problema, pasos numerados y en que paso va el nino */
export function boardContext(script: BoardScript, currentStep: number): string {
  const lines = script.steps.map((s, i) => {
    const written = s.add
      .map(it => (it.kind === 'text' ? it.text : ''))
      .filter(Boolean)
      .join(' | ')
    return `Paso ${i + 1}: ${written ? `[en la pizarra: ${written}] ` : ''}${s.say}`
  })
  return [
    `Problema: ${script.title}`,
    ...lines,
    `Respuesta: ${script.answer}`,
    `El niño está viendo el paso ${currentStep + 1} de ${script.steps.length}.`,
  ].join('\n')
}

/** **negrita** y saltos de linea, sin interpretar HTML */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, k) =>
            part.startsWith('**') && part.endsWith('**') ? <strong key={k}>{part.slice(2, -2)}</strong> : part,
          )}
        </p>
      ))}
    </>
  )
}

export default function StepChat({ script, currentStep, draft, voiceId = SYSTEM_VOICE, readAloud = false }: StepChatProps) {
  const { t, lang } = useI18n()
  const systemVoice = useSystemVoice()
  const canSpeak = voiceId !== SYSTEM_VOICE || systemVoice.available
  /** Respuesta que se esta leyendo (su posicion en la conversacion) */
  const [speaking, setSpeaking] = useState<number | null>(null)
  // Solo se corta la voz si la estaba usando este chat (la pizarra tambien usa el mismo canal)
  const speakingRef = useRef<number | null>(null)
  speakingRef.current = speaking
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!draft) return
    setInput(draft.text)
    inputRef.current?.focus()
  }, [draft])

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  /** Lee una respuesta de la maestra; si ya se estaba leyendo, la detiene */
  const say = useCallback(async (text: string, index: number) => {
    setSpeaking(index)
    notifyVoiceInterrupt() // la narracion de la pizarra se pausa mientras la maestra contesta
    const result = await speak(plainSpeech(text), voiceId, lang)
    setSpeaking(current => (current === index ? null : current))
    if (result === 'failed') logUi('warn', 'voz', 'No se pudo leer la respuesta del chat')
  }, [voiceId, lang])

  // Al salir del chat, o al apagar la lectura, se calla lo que se estaba leyendo
  useEffect(() => () => { if (speakingRef.current !== null) stopSpeaking() }, [])
  useEffect(() => {
    if (!readAloud && speakingRef.current !== null) {
      stopSpeaking()
      setSpeaking(null)
    }
  }, [readAloud])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || loading) return
    if (speakingRef.current !== null) {
      stopSpeaking() // una pregunta nueva corta la lectura anterior del chat
      setSpeaking(null)
    }
    const next: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setInput('')
    setError('')
    setLoading(true)
    try {
      const answer = await invoke<string>('ask_about_steps', {
        context: boardContext(script, currentStep),
        messages: next,
        language: lang,
      })
      setMessages([...next, { role: 'assistant', content: answer }])
      // Solo se lee lo que contesta la maestra, nunca lo que escribe el nino
      if (readAloud && canSpeak) void say(answer, next.length)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e?.message || t('chat.errAnswer'))
    } finally {
      setLoading(false)
    }
  }

  const step = currentStep + 1
  const quick = [t('chat.quick1', { n: step }), t('chat.quick2', { n: step }), t('chat.quick3')]

  return (
    <aside className="step-chat" aria-label={t('chat.label')}>
      <div className="step-chat-header">
        <span aria-hidden="true">💬</span>
        <div>
          <h3>{t('chat.title')}</h3>
          <small>{t('chat.subtitle')}</small>
        </div>
      </div>

      <div className="step-chat-messages" ref={listRef} role="log" aria-live="polite" aria-label={t('chat.title')}>
        {messages.length === 0 && (
          <div className="step-chat-empty">
            {t('chat.empty')}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <span className="chat-avatar" aria-hidden="true">{m.role === 'user' ? '🧒' : '👩‍🏫'}</span>
            <div className="chat-bubble">
              <Rich text={m.content} />
              {m.role === 'assistant' && canSpeak && (
                <button
                  type="button"
                  className="chat-listen"
                  aria-pressed={speaking === i}
                  aria-label={speaking === i ? t('chat.stopListening') : t('chat.listen')}
                  title={speaking === i ? t('chat.stopListening') : t('chat.listen')}
                  onClick={() => { if (speaking === i) { stopSpeaking(); setSpeaking(null) } else void say(m.content, i) }}
                >
                  <span aria-hidden="true">{speaking === i ? '⏹' : '🔊'}</span>
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <span className="chat-avatar" aria-hidden="true">👩‍🏫</span>
            <div className="chat-bubble chat-typing" role="status">{t('chat.thinking')}</div>
          </div>
        )}
        {error && <div className="error-message" role="alert">{error}</div>}
      </div>

      <div className="step-chat-quick">
        {quick.map(q => (
          <button key={q} className="chip" onClick={() => ask(q)} disabled={loading}>{q}</button>
        ))}
      </div>

      <form className="step-chat-form" onSubmit={e => { e.preventDefault(); void ask(input) }}>
        <textarea
          ref={inputRef}
          aria-label={t('chat.inputLabel')}
          maxLength={2000}
          value={input}
          rows={2}
          placeholder={t('chat.placeholder', { n: step })}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(input)
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>{t('chat.send')}</button>
      </form>
    </aside>
  )
}
