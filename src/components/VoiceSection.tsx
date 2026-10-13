import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import Switch from './Switch'
import { logUi } from '../lib/applog'
import { useT, type MessageKey } from '../lib/i18n'
import { SYSTEM_VOICE, speak, stopSpeaking, systemVoiceAvailable, type VoiceInfo } from '../lib/voice'

interface VoiceSectionProps {
  /** Voz elegida: 'system' o el id de una voz descargada */
  voice: string
  onChange: (voiceId: string) => void
  /** Lectura en voz alta de cada paso */
  readAloud: boolean
  onReadAloudChange: (on: boolean) => void
}

export default function VoiceSection({ voice, onChange, readAloud, onReadAloudChange }: VoiceSectionProps) {
  const t = useT()
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
      setError(t('voice.errDownload', { message: p?.message ?? t('voice.errUnknown') }))
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

  const nameOf = (id: string) => t(`voice.${id}.name` as MessageKey)
  const descOf = (id: string) => t(`voice.${id}.desc` as MessageKey)

  const run = async (cmd: string, voiceId: string) => {
    setError('')
    try {
      await invoke(cmd, { voiceId })
    } catch (e) {
      setError(typeof e === 'string' ? e : t('voice.errAction'))
    }
    await load()
  }

  const test = async (voiceId: string, name: string) => {
    setTesting(voiceId)
    setStatus(t('voice.statusTesting', { name }))
    const result = await speak(t('voice.sample'), voiceId)
    setTesting(null)
    setStatus(result === 'failed' ? t('voice.errPlay', { name }) : '')
    if (result === 'failed') {
      setError(t('voice.errPlay', { name }))
      logUi('warn', 'voz', `La prueba de la voz «${voiceId}» falló`)
    }
  }

  const remove = async (v: VoiceInfo) => {
    if (!confirm(t('voice.deleteConfirm', { name: nameOf(v.id) }))) return
    await run('delete_voice', v.id)
  }

  return (
    <div className="provider-section">
      <h2><span aria-hidden="true">🗣️</span> {t('voice.title')}</h2>
      <div className="ui-pref voice-read-aloud">
        <div className="ui-pref-text">
          <strong>{t('voice.readAloud')}</strong>
          <small>{t('voice.readAloudHelp')}</small>
        </div>
        <Switch checked={readAloud} onChange={onReadAloudChange} label={t('voice.readAloud')} />
      </div>

      <p className="section-hint" id="voice-hint">{t('voice.hint')}</p>

      <div role="radiogroup" aria-labelledby="voice-hint" className="voice-list">
        <VoiceRow
          id={SYSTEM_VOICE}
          name={t('voice.system')}
          description={t('voice.systemDesc')}
          selected={voice === SYSTEM_VOICE}
          available={systemVoiceAvailable()}
          unavailableText={t('voice.systemMissing')}
          testing={testing === SYSTEM_VOICE}
          onSelect={() => onChange(SYSTEM_VOICE)}
          onTest={() => void test(SYSTEM_VOICE, t('voice.systemShort'))}
        />
        {voices.map(v => (
          <VoiceRow
            key={v.id}
            id={v.id}
            name={nameOf(v.id)}
            description={descOf(v.id)}
            sizeMb={v.size_mb}
            selected={voice === v.id}
            available={v.is_downloaded}
            downloading={v.is_downloading}
            progress={v.download_progress}
            testing={testing === v.id}
            onSelect={() => onChange(v.id)}
            onTest={() => void test(v.id, nameOf(v.id))}
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
  const t = useT()
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
          {p.sizeMb !== undefined && !p.available && !p.downloading && ` ${t('voice.size', { mb: p.sizeMb })}`}
          {!p.available && p.unavailableText && ` ${p.unavailableText}`}
        </small>
        {p.downloading && (
          <div className="voice-progress">
            <progress max={100} value={pct} aria-label={t('voice.downloading', { name: p.name })} />
            <span aria-hidden="true">{pct < 95 ? `${pct} %` : t('voice.preparing')}</span>
          </div>
        )}
      </div>
      <div className="voice-actions">
        {p.available && (
          <button type="button" className="btn btn-secondary" onClick={p.onTest} disabled={p.testing} aria-label={t('voice.testAria', { name: p.name })}>
            {p.testing ? t('voice.testing') : <><span aria-hidden="true">▶</span> {t('voice.test')}</>}
          </button>
        )}
        {!p.available && p.onDownload && !p.downloading && (
          <button type="button" className="btn btn-primary" onClick={p.onDownload} aria-label={t('voice.downloadAria', { name: p.name })}>
            <span aria-hidden="true">⬇</span> {t('voice.download')}
          </button>
        )}
        {p.downloading && p.onCancel && (
          <button type="button" className="btn btn-secondary" onClick={p.onCancel} aria-label={t('voice.cancelAria', { name: p.name })}>
            {t('voice.cancel')}
          </button>
        )}
        {p.available && p.onDelete && (
          <button type="button" className="btn btn-secondary" onClick={p.onDelete} aria-label={t('voice.deleteAria', { name: p.name })}>
            <span aria-hidden="true">🗑</span>
          </button>
        )}
      </div>
    </div>
  )
}
