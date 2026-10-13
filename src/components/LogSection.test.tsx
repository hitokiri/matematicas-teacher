import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockInvoke } from '../test-setup'
import LogSection from './LogSection'
import { filterEntries, logToText, type LogEntry } from '../lib/applog'

const entries: LogEntry[] = [
  { time: '2026-10-13 17:20:01', level: 'INFO', source: 'app', message: 'La app arrancó' },
  { time: '2026-10-13 17:20:05', level: 'WARN', source: 'modelo de IA', message: 'Plantilla Jinja no soportada' },
  { time: '2026-10-13 17:20:09', level: 'ERROR', source: 'voz', message: 'No se pudo descargar la voz' },
]
const snap = { header: 'Matemáticas Teacher 0.2.0 · linux', file: '/tmp/app.log', entries }

beforeEach(() => {
  mockInvoke.mockReset()
  mockInvoke.mockImplementation(async (cmd: string) => (cmd === 'get_logs' ? snap : undefined))
})

describe('LogSection', () => {
  it('cerrado avisa cuantos errores hay, y abierto muestra el registro con el nivel en texto', async () => {
    render(<LogSection />)
    await userEvent.click(screen.getByText('Ver el registro'))
    const log = await screen.findByRole('log', { name: 'Registro de la app' })
    expect(log).toHaveTextContent('No se pudo descargar la voz')
    expect(log).toHaveTextContent('Error')
    expect(log).toHaveTextContent('Aviso')
    expect(screen.getByText('/tmp/app.log')).toBeInTheDocument()
  })

  it('filtra por gravedad', async () => {
    render(<LogSection />)
    await userEvent.click(screen.getByText('Ver el registro'))
    await screen.findByRole('log')
    await userEvent.selectOptions(screen.getByLabelText('Mostrar'), 'error')
    const log = screen.getByRole('log')
    expect(log).toHaveTextContent('No se pudo descargar la voz')
    expect(log).not.toHaveTextContent('La app arrancó')
  })

  it('copia todo el registro con su encabezado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<LogSection />)
    await userEvent.click(screen.getByText('Ver el registro'))
    await userEvent.click(await screen.findByRole('button', { name: /copiar/i }))
    expect(writeText.mock.calls[0][0]).toContain('Matemáticas Teacher 0.2.0')
    expect(writeText.mock.calls[0][0]).toContain('[ERROR] voz: No se pudo descargar la voz')
  })

  it('borrar vacia el registro en el backend', async () => {
    render(<LogSection />)
    await userEvent.click(screen.getByText('Ver el registro'))
    await userEvent.click(await screen.findByRole('button', { name: /borrar/i }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('clear_logs'))
  })

  it('si no se puede leer avisa con role=alert', async () => {
    mockInvoke.mockRejectedValue('fallo')
    render(<LogSection />)
    await userEvent.click(screen.getByText('Ver el registro'))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer el registro')
  })
})

describe('utilidades del registro', () => {
  it('filterEntries', () => {
    expect(filterEntries(entries, 'all')).toHaveLength(3)
    expect(filterEntries(entries, 'warn').map(e => e.level)).toEqual(['WARN', 'ERROR'])
    expect(filterEntries(entries, 'error').map(e => e.level)).toEqual(['ERROR'])
  })
  it('logToText', () => {
    expect(logToText(snap).split('\n').slice(0, 3)).toEqual(['Matemáticas Teacher 0.2.0 · linux', 'Archivo: /tmp/app.log', ''])
  })
})
