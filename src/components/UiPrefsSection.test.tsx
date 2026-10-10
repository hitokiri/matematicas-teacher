import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UiPrefsSection from './UiPrefsSection'
import LevelsPanel from './LevelsPanel'
import { DEFAULT_UI_PREFS } from '../lib/uiPrefs'

describe('configuracion de la interfaz', () => {
  it('cambia las pizarras a "todas juntas"', () => {
    const onChange = vi.fn()
    render(<UiPrefsSection prefs={DEFAULT_UI_PREFS} onChange={onChange} />)
    expect(screen.getByRole('button', { name: /una a la vez/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /todas juntas/i }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_UI_PREFS, boards: 'all' })
  })

  it('apaga la reproduccion automatica y el panel de temas', () => {
    const onChange = vi.fn()
    render(<UiPrefsSection prefs={DEFAULT_UI_PREFS} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: /reproducir/i }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_UI_PREFS, autoPlay: false })
    fireEvent.click(screen.getByRole('switch', { name: /hasta dónde llega/i }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_UI_PREFS, showLevels: false })
  })

  it('cambia el tamaño de letra', () => {
    const onChange = vi.fn()
    render(<UiPrefsSection prefs={DEFAULT_UI_PREFS} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Grande' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_UI_PREFS, fontScale: 1.2 })
  })

  it('cambia el tema si se le pasa', () => {
    const onTheme = vi.fn()
    render(<UiPrefsSection prefs={DEFAULT_UI_PREFS} onChange={vi.fn()} theme="light" onThemeChange={onTheme} />)
    fireEvent.click(screen.getByRole('button', { name: /oscuro/i }))
    expect(onTheme).toHaveBeenCalledWith('dark')
  })
})

describe('panel "¿Hasta dónde llega la maestra?"', () => {
  it('muestra los temas y escribe un ejemplo al pulsarlo', () => {
    const onTry = vi.fn()
    render(<LevelsPanel onTry={onTry} />)
    expect(screen.getByText(/hasta dónde llega la maestra/i)).toBeInTheDocument()
    expect(screen.getByText('Sistemas de dos ecuaciones')).toBeInTheDocument()
    expect(screen.getByText('Historial de problemas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'x + y = 5 ; x - y = 1' }))
    expect(onTry).toHaveBeenCalledWith('x + y = 5\nx - y = 1')
  })
})
