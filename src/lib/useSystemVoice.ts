import { useCallback, useEffect, useState } from 'react'
import { getSystemVoice, systemVoiceAvailable, type SystemVoiceInfo } from './voice'

/** Si la voz del sistema se puede usar (por el programa del sistema o por el navegador) y qué falta si no */
export function useSystemVoice() {
  const [info, setInfo] = useState<SystemVoiceInfo | null>(null)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    setChecking(true)
    setInfo(await getSystemVoice(true))
    setChecking(false)
  }, [])

  useEffect(() => { void check() }, [check])

  return {
    info,
    /** Aun no se sabe: se trata como disponible para no esconder nada de golpe */
    loaded: info !== null,
    available: info === null ? true : info.available || systemVoiceAvailable(),
    checking,
    check,
  }
}
