// Voz de la maestra: voces neuronales locales (Piper / Kokoro, las hace el backend) o, si no hay
// ninguna descargada, la voz del sistema (speechSynthesis). Todo lo que se lee pasa antes por
// spokenMath, para que "2x + 3y = 6" suene "dos equis más tres ye igual a seis".

import { invoke } from '@tauri-apps/api/core'
import { spokenMath } from './spokenMath'

export const SYSTEM_VOICE = 'system'

export interface VoiceInfo {
  id: string
  name: string
  description: string
  size_mb: number
  is_downloaded: boolean
  is_downloading: boolean
  /** 0-100 */
  download_progress: number
}

/** Como termino una lectura: completa, cortada por el usuario o con un error */
export type SpeakResult = 'done' | 'stopped' | 'failed'

export const systemVoiceAvailable = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window

// Audios ya generados (el del paso siguiente se prepara mientras suena el actual)
const MAX_CACHE = 8
const cache = new Map<string, Promise<Blob>>()

function fetchAudio(voiceId: string, text: string): Promise<Blob> {
  const key = `${voiceId}\u0000${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const p = invoke<ArrayBuffer>('synthesize_speech', { voiceId, text }).then(
    bytes => new Blob([bytes], { type: 'audio/wav' }),
  )
  p.catch(() => cache.delete(key)) // un error no se guarda
  cache.set(key, p)
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string)
  return p
}

/** Prepara el audio de un texto sin reproducirlo (solo voces neuronales) */
export function prefetch(text: string, voiceId: string): void {
  if (voiceId === SYSTEM_VOICE) return
  fetchAudio(voiceId, spokenMath(text)).catch(() => {})
}

let audio: HTMLAudioElement | null = null
let url: string | null = null
let cancelCurrent: (() => void) | null = null

/** Corta lo que se este leyendo */
export function stopSpeaking(): void {
  cancelCurrent?.()
  cancelCurrent = null
  if (systemVoiceAvailable()) window.speechSynthesis.cancel()
}

/** Lee el texto y avisa cuando termina. Nunca lanza: un fallo se devuelve como 'failed'. */
export function speak(text: string, voiceId: string): Promise<SpeakResult> {
  stopSpeaking()
  const spoken = spokenMath(text)
  if (!spoken) return Promise.resolve('done')
  return voiceId === SYSTEM_VOICE ? speakWithSystem(spoken) : speakWithNeural(spoken, voiceId)
}

function speakWithSystem(spoken: string): Promise<SpeakResult> {
  if (!systemVoiceAvailable()) return Promise.resolve('failed')
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(spoken)
    u.lang = 'es-MX'
    u.onend = () => resolve('done')
    u.onerror = e => resolve(e.error === 'canceled' || e.error === 'interrupted' ? 'stopped' : 'failed')
    cancelCurrent = () => resolve('stopped')
    window.speechSynthesis.speak(u)
  })
}

async function speakWithNeural(spoken: string, voiceId: string): Promise<SpeakResult> {
  let stopped = false
  cancelCurrent = () => {
    stopped = true
    audio?.pause()
    audio?.dispatchEvent(new Event('ended'))
  }
  const mine = cancelCurrent
  try {
    const blob = await fetchAudio(voiceId, spoken)
    if (stopped) return 'stopped'
    if (url) URL.revokeObjectURL(url)
    url = URL.createObjectURL(blob)
    audio = new Audio(url)
    const el = audio
    const result = await new Promise<SpeakResult>(resolve => {
      el.addEventListener('ended', () => resolve(stopped ? 'stopped' : 'done'), { once: true })
      el.addEventListener('error', () => resolve('failed'), { once: true })
      el.play().catch(() => resolve('failed'))
    })
    return result
  } catch {
    return stopped ? 'stopped' : 'failed'
  } finally {
    if (cancelCurrent === mine) cancelCurrent = null
  }
}
