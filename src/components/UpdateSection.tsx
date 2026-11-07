import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { checkForUpdate, currentVersion, installUpdate, restartApp, type DownloadEvent, type Update } from '../lib/updater'
import { logUi } from '../lib/applog'
import Ico from '../components/Ico'
import { Download, RefreshCw } from 'lucide-react'

type Status = 'idle' | 'checking' | 'upToDate' | 'available' | 'installing' | 'error'

export default function UpdateSection() {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')
  const [installed, setInstalled] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  // El Update del check() se reusa al instalar: no se vuelve a consultar el endpoint
  const updateRef = useRef<Update | null>(null)

  useEffect(() => {
    currentVersion().then(setInstalled).catch(() => setInstalled(null))
  }, [])

  const fail = (stage: string, e: unknown) => {
    logUi('error', 'updater', `${stage}: ${e instanceof Error ? e.message : String(e)}`)
    setStatus('error')
  }

  const check = async () => {
    setStatus('checking')
    setProgress(0)
    try {
      const update = await checkForUpdate()
      updateRef.current = update
      setStatus(update ? 'available' : 'upToDate')
    } catch (e) {
      fail('No se pudo buscar actualizaciones', e)
    }
  }

  const install = async () => {
    const update = updateRef.current
    if (!update) {
      setStatus('idle')
      return
    }
    setStatus('installing')
    setProgress(0)
    try {
      let downloaded = 0
      let total = 0
      await installUpdate(update, (e: DownloadEvent) => {
        if (e.event === 'Started') {
          total = e.data.contentLength ?? 0
          setProgress(0)
        } else if (e.event === 'Progress') {
          downloaded += e.data.chunkLength
          setProgress(total ? Math.min(100, Math.round((downloaded / total) * 100)) : 0)
        } else if (e.event === 'Finished') {
          setProgress(100)
        }
      })
      await restartApp()
    } catch (e) {
      fail('No se pudo instalar la actualización', e)
    }
  }

  const available = updateRef.current?.version ?? ''

  return (
    <div className="provider-section">
      <h2><Ico as={Download} /> {t('update.title')}</h2>
      <p className="compute-device">{t('update.current')}: {installed ?? t('update.currentVersion')}</p>

      {status === 'idle' || status === 'checking' || status === 'upToDate' || status === 'error' ? (
        <button type="button" className="chip" onClick={check} disabled={status === 'checking'}>
          <Ico as={RefreshCw} /> {status === 'checking' ? t('update.checking') : t('update.check')}
        </button>
      ) : null}

      {status === 'upToDate' && <p>{t('update.upToDate')}</p>}
      {status === 'error' && <p>{t('update.error')}</p>}

      {status === 'available' && (
        <>
          <p>{t('update.available', { v: available })}</p>
          <button type="button" className="chip" onClick={install}>
            <Ico as={Download} /> {t('update.install')}
          </button>
        </>
      )}

      {status === 'installing' && (
        <>
          <p>{t('update.installing')} {progress}%</p>
          <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
    </div>
  )
}
