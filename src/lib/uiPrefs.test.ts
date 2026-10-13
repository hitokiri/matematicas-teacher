import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_UI_PREFS, loadUiPrefs, saveUiPrefs } from './uiPrefs'

describe('preferencias de la interfaz', () => {
  beforeEach(() => localStorage.clear())

  it('por defecto: una pizarra a la vez, se reproduce sola y se ve el panel de temas', () => {
    expect(loadUiPrefs()).toEqual(DEFAULT_UI_PREFS)
    expect(DEFAULT_UI_PREFS.boards).toBe('one')
  })

  it('se guardan y se vuelven a cargar', () => {
    const prefs = { boards: 'all', autoPlay: false, showLevels: false, fontScale: 1.4, voice: 'kokoro-dora', readAloud: true } as const
    saveUiPrefs(prefs)
    expect(loadUiPrefs()).toEqual(prefs)
  })

  it('ignora valores rotos', () => {
    localStorage.setItem('ui-prefs', '{no es json')
    expect(loadUiPrefs()).toEqual(DEFAULT_UI_PREFS)
    localStorage.setItem('ui-prefs', JSON.stringify({ boards: 'muchas', autoPlay: 'si', fontScale: 7 }))
    expect(loadUiPrefs()).toEqual(DEFAULT_UI_PREFS)
  })

  it('una voz guardada con un id raro se descarta', () => {
    localStorage.setItem('ui-prefs', JSON.stringify({ voice: '../../etc/passwd' }))
    expect(loadUiPrefs().voice).toBe('system')
  })
})
