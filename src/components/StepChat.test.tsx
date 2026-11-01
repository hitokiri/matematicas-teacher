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

    it('un dictado que la app resuelve sola va a la pizarra, no al chat', async () => {
      mockInvoke.mockImplementation(async (cmd: string) =>
        cmd === 'list_mic_models' ? [{ id: 'whisper-turbo', is_downloaded: true }] : undefined
      )
      const onTranscript = vi.fn(() => true)
      render(<StepChat script={script} currentStep={0} onTranscript={onTranscript} />)
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('list_mic_models'))
      const onMic = handler('mic-transcript')
      act(() => onMic!({ payload: { text: '2 + 2' } }))
      expect(onTranscript).toHaveBeenCalledWith('2 + 2')
      expect(mockInvoke).not.toHaveBeenCalledWith('ask_about_steps', expect.anything())
    })

    describe('ejemplos en la pizarra', () => {
      const exampleOf = (q: string) => (q.includes('3/4 + 1/2') ? '3/4 + 1/2' : null)
      const ask = (q: string) => {
        fireEvent.change(screen.getByPlaceholderText(/escribe tu pregunta/i), { target: { value: q } })
        fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
      }
      const asked = () => mockInvoke.mock.calls.filter(c => c[0] === 'ask_about_steps')

      it('cualquier pregunta: primero pregunta si quiere la respuesta aqui o en la pizarra', async () => {
        render(<StepChat script={script} currentStep={0} onExample={vi.fn()} />)
        ask('¿por qué se resta 4?')
        expect(await screen.findByText(/responda aquí o que lo desarrolle en la pizarra/)).toBeInTheDocument()
        expect(asked()).toHaveLength(0)
      })

      it('«Respuesta aquí» contesta con el modelo sin pedir ejemplo', async () => {
        mockInvoke.mockResolvedValue('Porque quitamos lo mismo.')
        const onExample = vi.fn()
        render(<StepChat script={script} currentStep={0} onExample={onExample} />)
        ask('¿por qué se resta 4?')
        fireEvent.click(await screen.findByRole('button', { name: 'Respuesta aquí' }))
        expect(await screen.findByText('Porque quitamos lo mismo.')).toBeInTheDocument()
        expect(onExample).not.toHaveBeenCalled()
        expect(asked()[0][1].messages.at(-1).content).not.toContain('PIZARRA')
      })

      it('si la pregunta trae el problema, «pizarra» pasa directo a borrar o poner aparte', async () => {
        const onExample = vi.fn()
        render(<StepChat script={script} currentStep={0} exampleOf={exampleOf} onExample={onExample} />)
        ask('¿y cómo sería 3/4 + 1/2?')
        fireEvent.click(await screen.findByRole('button', { name: 'Desarrollarlo en la pizarra' }))
        expect(await screen.findByText(/Ese ejemplo lo puedo hacer en la pizarra: 3\/4 \+ 1\/2/)).toBeInTheDocument()
        expect(asked()).toHaveLength(0)
        fireEvent.click(screen.getByRole('button', { name: 'Ponerlo en otra pizarra' }))
        expect(onExample).toHaveBeenCalledWith('3/4 + 1/2', 'aside')
      })

      it('«Borrar y escribir aquí» manda el ejemplo a la pizarra principal', async () => {
        const onExample = vi.fn()
        render(<StepChat script={script} currentStep={0} exampleOf={exampleOf} onExample={onExample} />)
        ask('¿y cómo sería 3/4 + 1/2?')
        fireEvent.click(await screen.findByRole('button', { name: 'Desarrollarlo en la pizarra' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Borrar y escribir aquí' }))
        expect(onExample).toHaveBeenCalledWith('3/4 + 1/2', 'replace')
      })

      it('sin problema en la pregunta, la maestra propone uno con la etiqueta y se oculta', async () => {
        mockInvoke.mockResolvedValue('Mira, con otros números.\n[[PIZARRA: 3/4 + 1/2]]')
        const onExample = vi.fn()
        render(<StepChat script={script} currentStep={0} canShow={p => p} onExample={onExample} />)
        ask('no entiendo, ¿me das otro parecido?')
        fireEvent.click(await screen.findByRole('button', { name: 'Desarrollarlo en la pizarra' }))
        expect(await screen.findByText('Mira, con otros números.')).toBeInTheDocument()
        expect(screen.queryByText(/PIZARRA:/)).not.toBeInTheDocument()
        expect(asked()[0][1].messages.at(-1).content).toContain('[[PIZARRA: problema]]')
        fireEvent.click(await screen.findByRole('button', { name: 'Ponerlo en otra pizarra' }))
        expect(onExample).toHaveBeenCalledWith('3/4 + 1/2', 'aside')
      })

      it('si la pizarra no sabe resolver lo que propone la maestra, queda solo su respuesta', async () => {
        mockInvoke.mockResolvedValue('Es un tema difícil.\n[[PIZARRA: derivada de x²]]')
        render(<StepChat script={script} currentStep={0} canShow={() => null} onExample={vi.fn()} />)
        ask('¿qué es una derivada?')
        fireEvent.click(await screen.findByRole('button', { name: 'Desarrollarlo en la pizarra' }))
        expect(await screen.findByText('Es un tema difícil.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Ponerlo en otra pizarra' })).not.toBeInTheDocument()
      })

      it('«Solo respóndeme» en el segundo paso contesta con el modelo', async () => {
        mockInvoke.mockResolvedValue('Se busca el denominador común.')
        const onExample = vi.fn()
        render(<StepChat script={script} currentStep={0} exampleOf={exampleOf} onExample={onExample} />)
        ask('¿y cómo sería 3/4 + 1/2?')
        fireEvent.click(await screen.findByRole('button', { name: 'Desarrollarlo en la pizarra' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Solo respóndeme' }))
        expect(await screen.findByText('Se busca el denominador común.')).toBeInTheDocument()
        expect(onExample).not.toHaveBeenCalled()
      })
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
