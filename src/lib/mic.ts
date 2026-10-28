// Micrófono: hablar en vez de escribir. El backend captura el audio (cpal) y lo transcribe
// con Whisper local (sherpa-onnx); aquí solo se piden los modelos y se habla con los comandos.

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export interface SttModelInfo {
  id: string
  name: string
  description: string
  size_mb: number
  is_downloaded: boolean
  is_downloading: boolean
  /** 0-100 */
  download_progress: number
}

/** Estado del micrófono: grabando, transcribiendo o en reposo */
export type MicState = 'idle' | 'recording' | 'transcribing' | 'empty'

/** El backend avisa de cada cambio de estado */
export const MIC_STATE = 'mic-state'
/** Texto reconocido (lo que dijo el niño) */
export const MIC_TRANSCRIPT = 'mic-transcript'
/** Algo falló (micro no disponible, modelo incompleto…) */
export const MIC_ERROR = 'mic-error'
/** Cambió la lista de modelos descargados */
export const MIC_MODELS_UPDATED = 'mic-models-updated'

export const listMicModels = (): Promise<SttModelInfo[]> => invoke('list_mic_models')

export const startListening = (language: string, modelId?: string): Promise<void> =>
  invoke('start_listening', { language, modelId })

export const stopListening = (): Promise<void> => invoke('stop_listening')

export const isListening = (): Promise<boolean> => invoke('mic_listening')

/** Los eventos llegan como `{ state }`, `{ text, language }` o `{ message }` */
export interface MicStateEvent {
  state: MicState
}
export interface MicTranscriptEvent {
  text: string
  language?: string
}
export interface MicErrorEvent {
  message: string
}

interface Listeners {
  onState?: (state: MicState) => void
  onTranscript?: (text: string) => void
  onError?: (message: string) => void
}

/** Se suscribe a los eventos del micrófono; devuelve la función para desuscribirse */
export function onMicEvents(listeners: Listeners): () => void {
  const unlisteners: Array<() => void> = []
  let disposed = false
  const add = (event: string, handler: (payload: any) => void) => {
    Promise.resolve(listen(event, e => handler((e as { payload?: unknown })?.payload)))
      .then(un => {
        if (typeof un !== 'function') return
        if (disposed) un()
        else unlisteners.push(un)
      })
      .catch(() => {})
  }
  add(MIC_STATE, payload => {
    const state = payload?.state
    if (state === 'idle' || state === 'recording' || state === 'transcribing' || state === 'empty') {
      listeners.onState?.(state)
    }
  })
  add(MIC_TRANSCRIPT, payload => {
    const text = typeof payload?.text === 'string' ? payload.text : ''
    if (text) listeners.onTranscript?.(text)
  })
  add(MIC_ERROR, payload => {
    listeners.onError?.(typeof payload?.message === 'string' ? payload.message : '')
  })
  return () => {
    disposed = true
    unlisteners.forEach(un => un())
  }
}
