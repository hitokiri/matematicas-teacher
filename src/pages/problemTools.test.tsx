import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import MainApp from './MainApp'
import StepChat from '../components/StepChat'
import { I18nProvider } from '../lib/i18n'
import { equationScript, parseEquation } from '../lib/board/equation'
import { mockInvoke, mockListen } from '../test-setup'

const box = () => screen.getByLabelText('Tu problema matemático') as HTMLTextAreaElement
const mount = () => render(<I18nProvider><MainApp settings={{ active_model_id: null }} /></I18nProvider>)
/** Como en la app: cada componente tiene su propio oyente y el evento llega a todos */
const emit = (name: string, payload: unknown) => {
  const calls = (vi.mocked(mockListen).mock.calls as any[][]).filter(c => c[0] === name)
  act(() => calls.forEach(c => c[1]({ payload })))
}

describe('herramientas junto al problema', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockInvoke.mockResolvedValue(undefined)
    vi.mocked(mockListen).mockClear()
  })

  it('el boton de simbolos abre un grupo con nombre y cada simbolo se escribe en el cursor', () => {
    mount()
    fireEvent.change(box(), { target: { value: '3 5' } })
    box().setSelectionRange(2, 2)
    const toggle = screen.getByRole('button', { name: /Símbolos/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('group', { name: 'Símbolos matemáticos' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'por' }))
    expect(box().value).toBe('3 ×5')
  })

  it('cada simbolo tiene nombre accesible y Escape cierra devolviendo el foco', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: /Símbolos/ }))
    for (const name of ['más', 'menos', 'por', 'entre', 'raíz cuadrada', 'al cuadrado', 'abrir paréntesis']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    fireEvent.keyDown(screen.getByRole('group', { name: 'Símbolos matemáticos' }), { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Símbolos matemáticos' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Símbolos/ })).toHaveFocus()
  })

  it('el boton de hablar pide el micro y lo dictado se escribe en la caja', async () => {
    mockInvoke.mockImplementation(async (cmd: string) =>
      cmd === 'list_mic_models' ? [{ id: 'whisper-turbo', is_downloaded: true }] : undefined)
    mount()
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('list_mic_models'))
    fireEvent.click(screen.getByRole('button', { name: 'Hablar para escribir tu problema' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('start_listening', expect.anything()))
    emit('mic-transcript', { text: 'divide trescientos entre cincuenta' })
    expect(box().value).toBe('divide trescientos entre cincuenta')
  })

  it('sin modelo de voz avisa con una alerta', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => (cmd === 'list_mic_models' ? [] : undefined))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Hablar para escribir tu problema' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/descarga un modelo de voz/)
  })

  it('lo dictado en la caja del problema no llega tambien al chat', async () => {
    mockInvoke.mockImplementation(async (cmd: string) =>
      cmd === 'list_mic_models' ? [{ id: 'whisper-turbo', is_downloaded: true }] : undefined)
    render(
      <I18nProvider>
        <MainApp settings={{ active_model_id: null }} />
        <StepChat script={equationScript(parseEquation('2x + 4 = 10')!)} currentStep={0} />
      </I18nProvider>,
    )
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('list_mic_models'))
    fireEvent.click(screen.getByRole('button', { name: 'Hablar para escribir tu problema' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('start_listening', expect.anything()))
    emit('mic-transcript', { text: 'hola' })
    emit('mic-state', { state: 'idle' })
    expect(box().value).toBe('hola')
    expect(screen.queryByText('hola', { selector: '.chat-bubble *' })).not.toBeInTheDocument()
    expect(mockInvoke).not.toHaveBeenCalledWith('ask_about_steps', expect.anything())
  })
})
