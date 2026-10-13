import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { SYSTEM_VOICE, speak, stopSpeaking, systemVoiceAvailable, type VoiceInfo } from '../lib/voice'

interface VoiceSectionProps {
  /** Voz elegida: 'system' o el id de una voz descargada */
  voice: string
  onChange: (voiceId: string) => void
}

const SAMPLE = 'Hola, soy tu maestra. Dos equis más tres igual a siete. ¡Vamos a resolverlo juntos!'

export default function VoiceSection({ voice, onChange }: VoiceSectionProps) {
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [error, setError] = useState('')
  const [testing, setTesting] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const loaded = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await invoke<VoiceInfo[]>('list_voices')
      setVoices(Array.isArray(res) ? res : [])
    } catch {
      setVoices([])
    }
    loaded.current = true
  }, [])

  useEffect(() => {
    void load()
    const unlisteners: Array<() => void> = []
    let disposed = false
    const on = (event: string, handler: (payload: any) => void) =>
      Promise.resolve(listen(event, e => handler((e as { payload?: unknown })?.payload)))
        .then(un => { if (typeof un !== 'function') return; if (disposed) un(); else unlisteners.push(un) })
        .catch(() => {})
    void on('voices-updated', () => void load())
    void on('voice-download-progress', () => void load())
    void on('voice-download-error', p => {
      setError(`No se pudo descargar la voz: ${p?.message ?? 'error desconocido'}`)
      void load()
    })
    return () => {
      disposed = true
      unlisteners.forEach(un => un())
      stopSpeaking()
    }
  }, [load])

  // Si la voz elegida ya no esta (se borro), se vuelve a la del sistema
  useEffect(() => {
    if (loaded.current && voice !== SYSTEM_VOICE && voices.length && !voices.some(v => v.id === voice && v.is_downloaded)) {
      onChange(SYSTEM_VOICE)
    }
  }, [voices, voice, onChange])

  const run = async (cmd: string, voiceId: string) => {
    setError('')
    try {
      await invoke(cmd, { voiceId })
    } catch (e) {
      setError(typeof e === 'string' ? e : 'No se pudo completar la acción')
    }
    await load()
  }

  const test = async (voiceId: string, name: string) => {
    setTesting(voiceId)
    setStatus(`Probando la voz ${name}`)
    const result = await speak(SAMPLE, voiceId)
    setTesting(null)
    setStatus(result === 'failed' ? `No se pudo reproducir la voz ${name}` : '')
    if (result === 'failed') setError(`No se pudo reproducir la voz ${name}.`)
  }

  const remove = async (v: VoiceInfo) => {
    if (!confirm(`¿Eliminar la voz "${v.name}"? Podrás descargarla otra vez.`)) return
    await run('delete_voice', v.id)
  }

  return (
    <div className="provider-section">
      <h2>🗣️ Voz de la maestra</h2>
      <p className="section-hint" id="voice-hint">
        Elige con qué voz lee la maestra. Las voces naturales se descargan una vez y funcionan sin internet.
      </p>

      <div role="radiogroup" aria-labelledby="voice-hint" className="voice-list">
        <VoiceRow
          id={SYSTEM_VOICE}
          name="Voz del sistema"
          description="La que trae tu computadora; suena más robótica."
          selected={voice === SYSTEM_VOICE}
          available={systemVoiceAvailable()}
          unavailableText="Tu sistema no tiene voz instalada."
          testing={testing === SYSTEM_VOICE}
          onSelect={() => onChange(SYSTEM_VOICE)}
          onTest={() => void test(SYSTEM_VOICE, 'del sistema')}
        />
        {voices.map(v => (
          <VoiceRow
            key={v.id}
            id={v.id}
            name={v.name}
            description={v.description}
            sizeMb={v.size_mb}
            selected={voice === v.id}
            available={v.is_downloaded}
            downloading={v.is_downloading}
            progress={v.download_progress}
            testing={testing === v.id}
            onSelect={() => onChange(v.id)}
            onTest={() => void test(v.id, v.name)}
            onDownload={() => void run('download_voice', v.id)}
            onCancel={() => void run('cancel_voice_download', v.id)}
            onDelete={() => void remove(v)}
          />
        ))}
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">{status}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}

interface RowProps {
  id: string
  name: string
  description: string
  sizeMb?: number
  selected: boolean
  available: boolean
  unavailableText?: string
  downloading?: boolean
  progress?: number
  testing: boolean
  onSelect: () => void
  onTest: () => void
  onDownload?: () => void
  onCancel?: () => void
  onDelete?: () => void
}

function VoiceRow(p: RowProps) {
  const labelId = `voice-${p.id}-name`
  const descId = `voice-${p.id}-desc`
  const pct = Math.round(p.progress ?? 0)
  return (
    <div className={`voice-row ${p.selected ? 'selected' : ''}`}>
      <input
        type="radio"
        name="voice"
        id={`voice-${p.id}`}
        checked={p.selected}
        disabled={!p.available}
        onChange={p.onSelect}
        aria-labelledby={labelId}
        aria-describedby={descId}
      />
      <div className="voice-text">
        <label id={labelId} htmlFor={`voice-${p.id}`}><strong>{p.name}</strong></label>
        <small id={descId}>
          {p.description}
          {p.sizeMb !== undefined && !p.available && !p.downloading && ` Descarga de ${p.sizeMb} MB.`}
          {!p.available && p.unavailableText && ` ${p.unavailableText}`}
        </small>
        {p.downloading && (
          <div className="voice-progress">
            <progress max={100} value={pct} aria-label={`Descargando ${p.name}`} />
            <span aria-hidden="true">{pct < 95 ? `${pct} %` : 'Preparando…'}</span>
          </div>
        )}
      </div>
      <div className="voice-actions">
        {p.available && (
          <button type="button" className="btn btn-secondary" onClick={p.onTest} disabled={p.testing} aria-label={`Probar la voz ${p.name}`}>
            {p.testing ? 'Sonando…' : '▶ Probar'}
          </button>
        )}
        {!p.available && p.onDownload && !p.downloading && (
          <button type="button" className="btn btn-primary" onClick={p.onDownload} aria-label={`Descargar la voz ${p.name}`}>
            ⬇ Descargar
          </button>
        )}
        {p.downloading && p.onCancel && (
          <button type="button" className="btn btn-secondary" onClick={p.onCancel} aria-label={`Cancelar la descarga de ${p.name}`}>
            Cancelar
          </button>
        )}
        {p.available && p.onDelete && (
          <button type="button" className="btn btn-secondary" onClick={p.onDelete} aria-label={`Eliminar la voz ${p.name}`}>
            🗑
          </button>
        )}
      </div>
    </div>
  )
}
