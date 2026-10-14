// Voz de la maestra: voces neuronales locales (Piper / Kokoro, las hace el backend) o, si no hay
// ninguna descargada, la voz del sistema (speechSynthesis). Todo lo que se lee pasa antes por
// spokenMath, para que "2x + 3y = 6" suene "dos equis más tres ye igual a seis".

import { invoke } from '@tauri-apps/api/core'
import { spokenMath, type SpokenLang } from './spokenMath'
import { logUi } from './applog'

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
  /** Idioma que habla: "es" o "en" */
  lang: 'es' | 'en'
}

/** Como termino una lectura: completa, cortada por el usuario o con un error */
export type SpeakResult = 'done' | 'stopped' | 'failed'

/** Lo que hay (o falta) en esta computadora para la voz del sistema */
export interface SystemVoiceInfo {
  available: boolean
  engine: string | null
  os: string
  install_command: string | null
}

const NO_SYSTEM_VOICE: SystemVoiceInfo = { available: false, engine: null, os: '', install_command: null }
let systemInfo: SystemVoiceInfo | null = null

/** Pregunta al backend si hay un programa de voz (espeak-ng); `fresh` vuelve a comprobar */
export async function getSystemVoice(fresh = false): Promise<SystemVoiceInfo> {
  if (systemInfo && !fresh) return systemInfo
  try {
    const res = await invoke<SystemVoiceInfo>('get_system_voice')
    systemInfo = res && typeof res.available === 'boolean' ? res : NO_SYSTEM_VOICE
  } catch {
    systemInfo = NO_SYSTEM_VOICE
  }
  return systemInfo
}

/** El navegador de la ventana trae voz (speechSynthesis). En varias distribuciones de Linux no. */
export const systemVoiceAvailable = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && !!window.speechSynthesis

// Audios ya generados (el del paso siguiente se prepara mientras suena el actual)
const MAX_CACHE = 8
const cache = new Map<string, Promise<Blob>>()

function fetchAudio(voiceId: string, text: string, lang: SpokenLang): Promise<Blob> {
  const key = `${voiceId}\u0000${lang}\u0000${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const p = invoke<ArrayBuffer>('synthesize_speech', { voiceId, text, language: lang }).then(
    bytes => new Blob([bytes], { type: 'audio/wav' }),
  )
  p.catch(() => cache.delete(key)) // un error no se guarda
  cache.set(key, p)
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string)
  return p
}

/** Prepara el audio de un texto sin reproducirlo (solo voces neuronales) */
export function prefetch(text: string, voiceId: string, lang: SpokenLang = 'es'): void {
  if (voiceId === SYSTEM_VOICE && !systemInfo?.available) return
  fetchAudio(voiceId, spokenMath(text, lang), lang).catch(() => {})
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
export function speak(text: string, voiceId: string, lang: SpokenLang = 'es'): Promise<SpeakResult> {
  stopSpeaking()
  const spoken = spokenMath(text, lang)
  if (!spoken) return Promise.resolve('done')
  if (voiceId !== SYSTEM_VOICE) return speakWithNeural(spoken, voiceId, lang)
  // Voz del sistema: primero el programa del sistema (espeak-ng); si no, la del navegador
  return getSystemVoice().then(info => (info.available ? speakWithNeural(spoken, SYSTEM_VOICE, lang) : speakWithSystem(spoken, lang)))
}

function speakWithSystem(spoken: string, lang: SpokenLang): Promise<SpeakResult> {
  if (!systemVoiceAvailable()) return Promise.resolve('failed')
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(spoken)
    u.lang = lang === 'en' ? 'en-US' : 'es-MX'
    u.onend = () => resolve('done')
    u.onerror = e => resolve(e.error === 'canceled' || e.error === 'interrupted' ? 'stopped' : 'failed')
    cancelCurrent = () => resolve('stopped')
    window.speechSynthesis.speak(u)
  })
}

async function speakWithNeural(spoken: string, voiceId: string, lang: SpokenLang): Promise<SpeakResult> {
  let stopped = false
  cancelCurrent = () => {
    stopped = true
    audio?.pause()
    audio?.dispatchEvent(new Event('ended'))
  }
  const mine = cancelCurrent
  try {
    const blob = await fetchAudio(voiceId, spoken, lang)
    if (stopped) return 'stopped'
    if (url) URL.revokeObjectURL(url)
    url = URL.createObjectURL(blob)
    audio = new Audio(url)
    const el = audio
    const result = await new Promise<SpeakResult>(resolve => {
      el.addEventListener('ended', () => resolve(stopped ? 'stopped' : 'done'), { once: true })
      el.addEventListener('error', () => {
        logUi('warn', 'voz', `El audio no se pudo reproducir (código ${el.error?.code ?? '?'}: ${el.error?.message ?? 'sin detalle'})`)
        resolve('failed')
      }, { once: true })
      el.play().catch(e => {
        logUi('warn', 'voz', `El navegador no dejó reproducir el audio: ${e?.name ?? ''} ${e?.message ?? e}`)
        resolve('failed')
      })
    })
    return result
  } catch {
    return stopped ? 'stopped' : 'failed'
  } finally {
    if (cancelCurrent === mine) cancelCurrent = null
  }
}
