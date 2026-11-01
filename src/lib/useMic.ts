// Dictar en una caja de texto: un boton de micro con su estado, sin chat ni pizarra de por medio.

import { useCallback, useEffect, useRef, useState } from 'react'
import { claimMic, listMicModels, onMicEvents, startListening, stopListening, type MicState } from './mic'
import { notifyVoiceInterrupt, stopSpeaking } from './voice'
import { useI18n } from './i18n'

export function useMic(owner: string, onText: (text: string) => void) {
  const { t, lang } = useI18n()
  const [state, setState] = useState<MicState>('idle')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  useEffect(() => {
    Promise.resolve(listMicModels())
      .then(models => setReady(Array.isArray(models) && models.some(m => m.is_downloaded)))
      .catch(() => setReady(false))
    const off = onMicEvents({
      onState: setState,
      onTranscript: text => {
        setError('')
        onTextRef.current(text)
      },
      onError: message => setError(message || t('chat.micErr')),
    }, owner)
    return () => {
      off()
      Promise.resolve(stopListening()).catch(() => {})
    }
  }, [owner, t])

  const toggle = useCallback(async () => {
    setError('')
    if (state === 'recording') {
      Promise.resolve(stopListening()).catch(() => {})
      return
    }
    if (state === 'transcribing') return
    // Puede haberse descargado un modelo en Configuracion con la pantalla ya abierta
    const available = ready
      || await Promise.resolve(listMicModels())
        .then(models => Array.isArray(models) && models.some(m => m.is_downloaded))
        .catch(() => false)
    if (!available) {
      setError(t('chat.micNeedModel'))
      return
    }
    if (!ready) setReady(true)
    stopSpeaking()
    notifyVoiceInterrupt()
    try {
      claimMic(owner)
      await startListening(lang)
    } catch (e: any) {
      claimMic(null)
      setError(typeof e === 'string' ? e : e?.message || t('chat.micErr'))
    }
  }, [state, ready, owner, lang, t])

  return { state, error, toggle }
}
