import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import StepChat, { boardContext } from './StepChat'
import { mockInvoke, mockListen } from '../test-setup'
import { parseEquation, equationScript } from '../lib/board/equation'
import { speak, stopSpeaking } from '../lib/voice'

vi.mock('../lib/voice', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/voice')>()),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
}))

const script = equationScript(parseEquation('2x + 4 = 10')!)

describe('StepChat', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    vi.mocked(mockListen).mockClear()
    vi.mocked(speak).mockReset()
    vi.mocked(speak).mockResolvedValue('done')
    vi.mocked(stopSpeaking).mockReset()
  })

  it('el contexto tiene el problema, los pasos numerados y el paso actual', () => {
    const ctx = boardContext(script, 2)
    expect(ctx).toContain('Problema: 2x + 4 = 10')
    expect(ctx).toContain('Paso 2: [en la pizarra: 2x + 4 − 4 = 10 − 4]')
    expect(ctx).toContain('Respuesta: x = 3')
    expect(ctx).toContain(`El niño está viendo el paso 3 de ${script.steps.length}`)
  })

  it('envia la pregunta con la conversacion y muestra la respuesta', async () => {
    mockInvoke.mockResolvedValue('Porque quitamos lo **mismo** de los dos lados.')
    render(<StepChat script={script} currentStep={1} />)
    fireEvent.change(screen.getByPlaceholderText(/escribe tu pregunta/i), { target: { value: '¿por qué se resta 4?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(screen.getByText('mismo')).toBeInTheDocument())
    expect(mockInvoke).toHaveBeenCalledWith('ask_about_steps', expect.objectContaining({
      messages: [{ role: 'user', content: '¿por qué se resta 4?' }],
    }))
  })

  it('muestra el error si no hay modelo', async () => {
    mockInvoke.mockImplementation(async () => { throw new Error('Para hacer preguntas selecciona un modelo en Configuracion.') })
    render(<StepChat script={script} currentStep={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'No entendí el paso 1' }))
    await waitFor(() => expect(screen.getByText(/selecciona un modelo/)).toBeInTheDocument())
    // vitest registra el rechazo del mock como error del test aunque el componente lo capture
    mockInvoke.mockReset()
  })

  it('la pregunta preparada al pulsar un paso aparece en la caja', () => {
    render(<StepChat script={script} currentStep={0} draft={{ text: 'Tengo una duda con el paso 2: ', nonce: 1 }} />)
    expect(screen.getByPlaceholderText(/escribe tu pregunta/i)).toHaveValue('Tengo una duda con el paso 2: ')
  })

  describe('lectura en voz alta de las respuestas', () => {
    const askQuestion = async () => {
      fireEvent.change(screen.getByPlaceholderText(/escribe tu pregunta/i), { target: { value: 'mi pregunta secreta' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    }

    it('lee solo lo que contesta la maestra, nunca lo que escribe el usuario', async () => {
      mockInvoke.mockResolvedValue('Porque quitamos lo **mismo** de los dos lados.\n- Por eso queda igual.')
      render(<StepChat script={script} currentStep={1} readAloud voiceId="piper-claude" />)
      await askQuestion()
      await waitFor(() => expect(speak).toHaveBeenCalledTimes(1))
      expect(speak).toHaveBeenCalledWith('Porque quitamos lo mismo de los dos lados. Por eso queda igual.', 'piper-claude', 'es')
      expect(vi.mocked(speak).mock.calls.some(c => String(c[0]).includes('secreta'))).toBe(false)
    })

    it('con la lectura apagada no se lee nada, pero cada respuesta tiene su boton para escucharla', async () => {
      mockInvoke.mockResolvedValue('Quitamos cuatro de los dos lados.')
      render(<StepChat script={script} currentStep={1} readAloud={false} voiceId="piper-claude" />)
      await askQuestion()
      const listen = await screen.findByRole('button', { name: 'Escuchar esta respuesta' })
      expect(speak).not.toHaveBeenCalled()
      fireEvent.click(listen)
      await waitFor(() => expect(speak).toHaveBeenCalledWith('Quitamos cuatro de los dos lados.', 'piper-claude', 'es'))
    })

    it('las preguntas del usuario no tienen boton de escuchar', async () => {
      mockInvoke.mockResolvedValue('Respuesta.')
      render(<StepChat script={script} currentStep={1} voiceId="piper-claude" />)
      await askQuestion()
      await screen.findByText('Respuesta.')
      expect(screen.getAllByRole('button', { name: 'Escuchar esta respuesta' })).toHaveLength(1)
    })

    it('una pregunta nueva corta la lectura anterior', async () => {
      mockInvoke.mockResolvedValue('Respuesta.')
      vi.mocked(speak).mockReturnValue(new Promise(() => {})) // la respuesta sigue sonando
      render(<StepChat script={script} currentStep={1} readAloud voiceId="piper-claude" />)
      await askQuestion()
      await waitFor(() => expect(speak).toHaveBeenCalled())
      vi.mocked(stopSpeaking).mockClear()
      await askQuestion()
      expect(stopSpeaking).toHaveBeenCalled()
    })
  })

  describe('micrófono', () => {
    const handler = (event: string) => {
      const call = (vi.mocked(mockListen).mock.calls as unknown as Array<[string, (e: any) => void]>)
        .find(c => c[0] === event)
      return call?.[1]
    }

    it('avisa si todavía no hay un modelo de voz descargado', async () => {
      mockInvoke.mockResolvedValue([])
      render(<StepChat script={script} currentStep={0} />)
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('list_mic_models'))
      fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))
      expect(await screen.findByText(/descarga un modelo de voz en Configuración/)).toBeInTheDocument()
    })

    it('al hablar pide al backend que escuche y corta la voz de la maestra', async () => {
      mockInvoke.mockImplementation(async (cmd: string) =>
        cmd === 'list_mic_models' ? [{ id: 'whisper-turbo', is_downloaded: true }] : undefined
      )
      render(<StepChat script={script} currentStep={0} />)
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('list_mic_models'))
      fireEvent.click(screen.getByRole('button', { name: 'Hablar' }))
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('start_listening', { language: 'es', modelId: undefined }))
      expect(stopSpeaking).toHaveBeenCalled()
    })

    it('lo que dicta el niño se pregunta como si lo hubiera escrito', async () => {
      mockInvoke.mockImplementation(async (cmd: string) =>
        cmd === 'list_mic_models'
          ? [{ id: 'whisper-turbo', is_downloaded: true }]
          : 'Porque restamos lo mismo en los dos lados.'
      )
      render(<StepChat script={script} currentStep={1} />)
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('list_mic_models'))
      const onTranscript = handler('mic-transcript')
      expect(onTranscript).toBeTruthy()
      act(() => onTranscript!({ payload: { text: '¿por qué se resta cuatro?' } }))
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('ask_about_steps', expect.objectContaining({
        messages: [{ role: 'user', content: '¿por qué se resta cuatro?' }],
      })))
    })

    it('el botón cambia a dejar de hablar mientras graba', async () => {
      mockInvoke.mockImplementation(async (cmd: string) =>
        cmd === 'list_mic_models' ? [{ id: 'whisper-turbo', is_downloaded: true }] : undefined
      )
      render(<StepChat script={script} currentStep={0} />)
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('list_mic_models'))
      const onState = handler('mic-state')
      act(() => onState!({ payload: { state: 'recording' } }))
      expect(screen.getByRole('button', { name: 'Dejar de hablar' })).toBeInTheDocument()
      expect(screen.getByText('Te escucho…')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Dejar de hablar' }))
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('stop_listening'))
    })
  })
})
