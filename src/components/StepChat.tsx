import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useT } from '../lib/i18n'
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

export default function StepChat({ script, currentStep, draft }: StepChatProps) {
  const t = useT()
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

  async function ask(question: string) {
    const q = question.trim()
    if (!q || loading) return
    const next: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setInput('')
    setError('')
    setLoading(true)
    try {
      const answer = await invoke<string>('ask_about_steps', {
        context: boardContext(script, currentStep),
        messages: next,
      })
      setMessages([...next, { role: 'assistant', content: answer }])
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
            <div className="chat-bubble"><Rich text={m.content} /></div>
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
