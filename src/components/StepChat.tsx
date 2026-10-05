import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
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
      setError(typeof e === 'string' ? e : e?.message || 'No pude responder')
    } finally {
      setLoading(false)
    }
  }

  const step = currentStep + 1
  const quick = [
    `No entendí el paso ${step}`,
    `¿Por qué se hace así el paso ${step}?`,
    'Dame otro ejemplo parecido',
  ]

  return (
    <aside className="step-chat" aria-label="Preguntas sobre los pasos">
      <div className="step-chat-header">
        <span aria-hidden="true">💬</span>
        <div>
          <h3>Preguntas</h3>
          <small>¿Tienes una duda? Pregúntale a la maestra sobre cualquier paso.</small>
        </div>
      </div>

      <div className="step-chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="step-chat-empty">
            Pulsa el número de un paso en la pizarra o escribe tu pregunta. Por ejemplo:
            <em> “¿Qué pasó con la raíz en el paso 3?”</em>
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
            <div className="chat-bubble chat-typing">Pensando<span>.</span><span>.</span><span>.</span></div>
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="step-chat-quick">
        {quick.map(q => (
          <button key={q} className="chip" onClick={() => ask(q)} disabled={loading}>{q}</button>
        ))}
      </div>

      <form className="step-chat-form" onSubmit={e => { e.preventDefault(); void ask(input) }}>
        <textarea
          ref={inputRef}
          value={input}
          rows={2}
          placeholder={`Escribe tu pregunta (por ejemplo sobre el paso ${step})...`}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(input)
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>Enviar</button>
      </form>
    </aside>
  )
}
