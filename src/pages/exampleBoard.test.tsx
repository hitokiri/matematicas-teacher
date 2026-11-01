import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MainApp from './MainApp'
import { I18nProvider } from '../lib/i18n'
import { mockInvoke } from '../test-setup'

const open = async (problem: string) => {
  render(<I18nProvider><MainApp settings={{ active_model_id: null }} /></I18nProvider>)
  fireEvent.change(screen.getByLabelText('Tu problema matemático'), { target: { value: problem } })
  fireEvent.click(screen.getByRole('button', { name: /Resolver problema/ }))
  await screen.findByPlaceholderText(/escribe tu pregunta/i)
}

const ask = (q: string) => {
  fireEvent.change(screen.getByPlaceholderText(/escribe tu pregunta/i), { target: { value: q } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
}

describe('ejemplos del chat en la pizarra', () => {
  beforeEach(() => { mockInvoke.mockReset(); mockInvoke.mockResolvedValue(undefined) })

  it('en otra pizarra: aparece aparte y la principal sigue con su problema', async () => {
    await open('2x + 4 = 10')
    ask('¿y cómo sería 3/4 + 1/2?')
    fireEvent.click(await screen.findByRole('button', { name: 'Desarrollarlo en la pizarra' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ponerlo en otra pizarra' }))
    const aside = await screen.findByRole('region', { name: 'Pizarra de ejemplo' })
    expect(aside).toHaveTextContent('3/4 + 1/2')
    expect(screen.getAllByText('2x + 4 = 10').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar pizarra de ejemplo' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pizarra de ejemplo' })).not.toBeInTheDocument())
  })

  it('borrar y escribir: la pizarra principal pasa al ejemplo', async () => {
    await open('2x + 4 = 10')
    ask('¿y cómo sería 3/4 + 1/2?')
    fireEvent.click(await screen.findByRole('button', { name: 'Desarrollarlo en la pizarra' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar y escribir aquí' }))
    expect(await screen.findByText(/Cada fracción es una pizza/)).toBeInTheDocument()
    expect(screen.queryByText(/Una ecuación es como una balanza/)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pizarra de ejemplo' })).not.toBeInTheDocument()
  })
})
