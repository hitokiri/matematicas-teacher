import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useT, type MessageKey } from '../lib/i18n'
import { filterEntries, logToText, type LogFilter, type LogSnapshot } from '../lib/applog'

export default function LogSection() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [snap, setSnap] = useState<LogSnapshot | null>(null)
  const [filter, setFilter] = useState<LogFilter>('all')
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const view = useRef<HTMLDivElement>(null)
  const stick = useRef(true) // seguir lo ultimo salvo que el usuario haya subido a leer

  const load = useCallback(async () => {
    try {
      const res = await invoke<LogSnapshot>('get_logs')
      setSnap(res && Array.isArray(res.entries) ? res : { header: '', file: '', entries: [] })
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  // Mientras esta abierto se actualiza solo
  useEffect(() => {
    if (!open) return
    void load()
    const t = window.setInterval(() => { if (!document.hidden) void load() }, 2500)
    return () => window.clearInterval(t)
  }, [open, load])

  const entries = snap ? filterEntries(snap.entries, filter) : []

  useEffect(() => {
    const el = view.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [entries.length, open])

  const onScroll = () => {
    const el = view.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }

  const copy = async () => {
    if (!snap) return
    try {
      await navigator.clipboard.writeText(logToText(snap))
      setStatus(t('log.copied'))
    } catch {
      setStatus(t('log.copyFailed'))
    }
  }

  const clear = async () => {
    try {
      await invoke('clear_logs')
      setStatus(t('log.cleared'))
    } catch {
      setStatus(t('log.clearFailed'))
    }
    await load()
  }

  const errors = snap ? snap.entries.filter(e => e.level === 'ERROR').length : 0

  return (
    <div className="provider-section">
      <h2><span aria-hidden="true">🪵</span> {t('log.title')}</h2>
      <p className="section-hint">{t('log.hint')}</p>

      <details className="log-details" open={open} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>
          {open ? t('log.hide') : t('log.show')}
          {!open && errors > 0 && <span className="log-badge">{t(errors === 1 ? 'log.error.one' : 'log.error.other', { n: errors })}</span>}
        </summary>

        <div className="log-toolbar">
          <label htmlFor="log-filter">{t('log.filter')}</label>
          <select id="log-filter" value={filter} onChange={e => setFilter(e.target.value as LogFilter)}>
            <option value="all">{t('log.filterAll')}</option>
            <option value="warn">{t('log.filterWarn')}</option>
            <option value="error">{t('log.filterError')}</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={() => void copy()} disabled={!snap?.entries.length}>
            <span aria-hidden="true">📋</span> {t('log.copy')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void clear()} disabled={!snap?.entries.length}>
            <span aria-hidden="true">🗑</span> {t('log.clear')}
          </button>
        </div>

        {failed && <p className="form-error" role="alert">{t('log.readFailed')}</p>}

        <div
          ref={view}
          className="log-view"
          role="log"
          aria-label={t('log.title')}
          tabIndex={0}
          onScroll={onScroll}
        >
          {entries.length === 0 ? (
            <p className="log-empty">{snap?.entries.length ? t('log.emptyFilter') : t('log.empty')}</p>
          ) : (
            entries.map((e, i) => (
              <div key={i} className={`log-row log-${e.level.toLowerCase()}`}>
                <span className="log-time">{e.time}</span>
                <span className="log-level">{['ERROR', 'WARN', 'INFO'].includes(e.level) ? t(`log.${e.level}` as MessageKey) : e.level}</span>
                <span className="log-source">{e.source}</span>
                <span className="log-message">{e.message}</span>
              </div>
            ))
          )}
        </div>

        {snap?.file && (
          <p className="log-file">
            {t('log.file')} <code>{snap.file}</code>
          </p>
        )}
        <p className="visually-hidden" role="status" aria-live="polite">{status}</p>
        {status && <p className="log-status" aria-hidden="true">{status}</p>}
      </details>
    </div>
  )
}
