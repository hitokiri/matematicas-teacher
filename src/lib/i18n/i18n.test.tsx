import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { es } from './es'
import { en } from './en'
import { I18nProvider, detectLang, translate, useI18n, rich } from './index'

describe('idiomas', () => {
  beforeEach(() => localStorage.clear())

  it('español e inglés tienen exactamente las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('ningun texto en ingles queda vacio y los {parametros} coinciden', () => {
    const params = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
    for (const key of Object.keys(es) as Array<keyof typeof es>) {
      expect(en[key].trim(), key).not.toBe('')
      expect(params(en[key]), key).toBe(params(es[key]))
    }
  })

  it('translate reemplaza parametros', () => {
    expect(translate('es', 'board.stepOf', { n: 2, total: 5 })).toBe('Paso 2 de 5')
    expect(translate('en', 'board.stepOf', { n: 2, total: 5 })).toBe('Step 2 of 5')
  })

  it('detecta el idioma guardado y, si no hay, el del sistema', () => {
    localStorage.setItem('lang', 'en')
    expect(detectLang()).toBe('en')
    localStorage.clear()
    Object.defineProperty(navigator, 'language', { value: 'es-MX', configurable: true })
    expect(detectLang()).toBe('es')
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true })
    expect(detectLang()).toBe('en')
    Object.defineProperty(navigator, 'language', { value: 'es-MX', configurable: true })
  })

  it('cambiar el idioma actualiza el texto, la etiqueta lang del documento y se guarda', () => {
    function Probe() {
      const { t, setLang } = useI18n()
      return <button onClick={() => setLang('en')}>{t('app.settings')}</button>
    }
    render(<I18nProvider><Probe /></I18nProvider>)
    expect(document.documentElement.lang).toBe('es')
    act(() => screen.getByRole('button', { name: 'Configuración' }).click())
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('lang')).toBe('en')
  })

  it('rich pone en negrita lo marcado', () => {
    render(<p>{rich('Ve a **Configuración** ya')}</p>)
    expect(screen.getByText('Configuración').tagName).toBe('STRONG')
  })
})
