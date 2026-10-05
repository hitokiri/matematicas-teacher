import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StepChat, { boardContext } from './StepChat'
import { mockInvoke } from '../test-setup'
import { parseEquation, equationScript } from '../lib/board/equation'

const script = equationScript(parseEquation('2x + 4 = 10')!)

describe('StepChat', () => {
  beforeEach(() => mockInvoke.mockReset())

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
})
