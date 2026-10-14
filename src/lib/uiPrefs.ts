// Preferencias de la interfaz (como se ve la app). Se guardan en el equipo, igual que el tema.

export interface UiPrefs {
  /** Pizarras de un proceso largo: solo la que se esta viendo o todas juntas */
  boards: 'one' | 'all'
  /** La pizarra se reproduce sola al resolver */
  autoPlay: boolean
  /** Mostrar el panel "¿Hasta dónde llega la maestra?" en la pantalla principal */
  showLevels: boolean
  /** Tamano de la letra de la pizarra y de la explicacion (uno de FONT_SCALES; 1 = normal) */
  fontScale: number
  /** Voz con que la maestra lee: 'system' (la del sistema) o el id de una voz descargada */
  voice: string
  /** Voz con que lee cuando la app esta en ingles */
  voiceEn: string
  /** La maestra lee en voz alta cada paso */
  readAloud: boolean
}

/** Tamanos de letra que se pueden elegir: chica, normal, grande, muy grande */
export const FONT_SCALES = [0.85, 1, 1.2, 1.4] as const

export const DEFAULT_UI_PREFS: UiPrefs = { boards: 'one', autoPlay: true, showLevels: true, fontScale: 1, voice: 'system', voiceEn: 'system', readAloud: false }

const KEY = 'ui-prefs'

export function loadUiPrefs(): UiPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<UiPrefs>
    return {
      boards: saved.boards === 'all' ? 'all' : 'one',
      autoPlay: typeof saved.autoPlay === 'boolean' ? saved.autoPlay : DEFAULT_UI_PREFS.autoPlay,
      showLevels: typeof saved.showLevels === 'boolean' ? saved.showLevels : DEFAULT_UI_PREFS.showLevels,
      fontScale: FONT_SCALES.find(f => f === saved.fontScale) ?? DEFAULT_UI_PREFS.fontScale,
      voice: typeof saved.voice === 'string' && /^[a-z0-9-]{1,40}$/.test(saved.voice) ? saved.voice : DEFAULT_UI_PREFS.voice,
      voiceEn: typeof saved.voiceEn === 'string' && /^[a-z0-9-]{1,40}$/.test(saved.voiceEn) ? saved.voiceEn : DEFAULT_UI_PREFS.voiceEn,
      readAloud: typeof saved.readAloud === 'boolean' ? saved.readAloud : DEFAULT_UI_PREFS.readAloud,
    }
  } catch {
    return { ...DEFAULT_UI_PREFS }
  }
}

export function saveUiPrefs(prefs: UiPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}
