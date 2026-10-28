import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { listMicModels, MIC_MODELS_UPDATED, type SttModelInfo } from '../lib/mic'
import { useI18n, type MessageKey } from '../lib/i18n'

/**
 * Modelos de reconocimiento de voz. Se descargan una vez y trabajan sin internet.
 * Los paquetes usan la misma descarga que las voces, por eso llegan los eventos `voice-*`.
 */
export default function MicSection() {
  const { t } = useI18n()
  const [models, setModels] = useState<SttModelInfo[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await listMicModels()
      setModels(Array.isArray(res) ? res : [])
    } catch {
      setModels([])
    }
  }, [])

  useEffect(() => {
    void load()
    const unlisteners: Array<() => void> = []
    let disposed = false
    const on = (event: string, handler: (payload: any) => void) =>
      Promise.resolve(listen(event, e => handler((e as { payload?: unknown })?.payload)))
        .then(un => {
          if (typeof un !== 'function') return
          if (disposed) un()
          else unlisteners.push(un)
        })
        .catch(() => {})
    void on('voices-updated', () => void load())
    void on('voice-download-progress', () => void load())
    void on(MIC_MODELS_UPDATED, () => void load())
    void on('voice-download-error', p => {
      setError(t('mic.errDownload', { message: p?.message ?? t('mic.errUnknown') }))
      void load()
    })
    return () => {
      disposed = true
      unlisteners.forEach(un => un())
    }
  }, [load, t])

  // Mientras algo se descarga se refresca solo (por si algún evento no llega)
  const anyDownloading = models.some(m => m.is_downloading)
  useEffect(() => {
    if (!anyDownloading) return
    const timer = window.setInterval(() => void load(), 1000)
    return () => window.clearInterval(timer)
  }, [anyDownloading, load])

  const run = async (cmd: string, modelId: string) => {
    setError('')
    try {
      await invoke(cmd, { modelId })
    } catch (e) {
      setError(typeof e === 'string' ? e : t('mic.errAction'))
    }
    await load()
  }

  const remove = async (model: SttModelInfo) => {
    const name = t(`mic.${model.id}.name` as MessageKey)
    if (!confirm(t('mic.deleteConfirm', { name }))) return
    await run('delete_mic_model', model.id)
  }

  return (
    <div className="provider-section">
      <h2><span aria-hidden="true">🎤</span> {t('mic.title')}</h2>
      <p className="section-hint">{t('mic.hint')}</p>
      <div className="voice-list">
        {models.map(model => {
          const name = t(`mic.${model.id}.name` as MessageKey)
          const desc = t(`mic.${model.id}.desc` as MessageKey)
          const pct = Math.round(model.download_progress ?? 0)
          return (
            <div key={model.id} className={`voice-row ${model.is_downloaded ? 'pickable' : 'unavailable'}`}>
              <div className="voice-text">
                <strong>{name}</strong>
                <small>
                  {desc}
                  {!model.is_downloaded && !model.is_downloading && ` ${t('mic.size', { mb: model.size_mb })}`}
                </small>
                {model.is_downloading && (
                  <div className="voice-progress">
                    <progress max={100} value={pct} aria-label={t('mic.downloading', { name })} />
                    <span aria-hidden="true">{pct < 95 ? `${pct} %` : t('voice.preparing')}</span>
                  </div>
                )}
              </div>
              <div className="voice-actions">
                {!model.is_downloaded && !model.is_downloading && (
                  <button type="button" className="btn btn-primary" onClick={() => void run('download_mic_model', model.id)} aria-label={t('mic.downloadAria', { name })}>
                    <span aria-hidden="true">⬇</span> {t('mic.download')}
                  </button>
                )}
                {model.is_downloading && (
                  <button type="button" className="btn btn-secondary" onClick={() => void run('cancel_mic_download', model.id)} aria-label={t('mic.cancelAria', { name })}>
                    {t('mic.cancel')}
                  </button>
                )}
                {model.is_downloaded && (
                  <button type="button" className="btn btn-secondary" onClick={() => void remove(model)} aria-label={t('mic.deleteAria', { name })}>
                    <span aria-hidden="true">🗑</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
