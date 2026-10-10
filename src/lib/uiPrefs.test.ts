import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_UI_PREFS, loadUiPrefs, saveUiPrefs } from './uiPrefs'

describe('preferencias de la interfaz', () => {
  beforeEach(() => localStorage.clear())

  it('por defecto: una pizarra a la vez, se reproduce sola y se ve el panel de temas', () => {
    expect(loadUiPrefs()).toEqual(DEFAULT_UI_PREFS)
    expect(DEFAULT_UI_PREFS.boards).toBe('one')
  })

  it('se guardan y se vuelven a cargar', () => {
    saveUiPrefs({ boards: 'all', autoPlay: false, showLevels: false, fontScale: 1.4 })
    expect(loadUiPrefs()).toEqual({ boards: 'all', autoPlay: false, showLevels: false, fontScale: 1.4 })
  })

  it('ignora valores rotos', () => {
    localStorage.setItem('ui-prefs', '{no es json')
    expect(loadUiPrefs()).toEqual(DEFAULT_UI_PREFS)
    localStorage.setItem('ui-prefs', JSON.stringify({ boards: 'muchas', autoPlay: 'si', fontScale: 7 }))
    expect(loadUiPrefs()).toEqual(DEFAULT_UI_PREFS)
  })
})
