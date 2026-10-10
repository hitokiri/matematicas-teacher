// Preferencias de la interfaz (como se ve la app). Se guardan en el equipo, igual que el tema.

export interface UiPrefs {
  /** Pizarras de un proceso largo: solo la que se esta viendo o todas juntas */
  boards: 'one' | 'all'
  /** La pizarra se reproduce sola al resolver */
  autoPlay: boolean
  /** Mostrar el panel "¿Hasta dónde llega la maestra?" en la pantalla principal */
  showLevels: boolean
}

export const DEFAULT_UI_PREFS: UiPrefs = { boards: 'one', autoPlay: true, showLevels: true }

const KEY = 'ui-prefs'

export function loadUiPrefs(): UiPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<UiPrefs>
    return {
      boards: saved.boards === 'all' ? 'all' : 'one',
      autoPlay: typeof saved.autoPlay === 'boolean' ? saved.autoPlay : DEFAULT_UI_PREFS.autoPlay,
      showLevels: typeof saved.showLevels === 'boolean' ? saved.showLevels : DEFAULT_UI_PREFS.showLevels,
    }
  } catch {
    return { ...DEFAULT_UI_PREFS }
  }
}

export function saveUiPrefs(prefs: UiPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}
