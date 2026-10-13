import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockInvoke } from '../test-setup'
import VoiceSection from './VoiceSection'

const voices = [
  { id: 'piper-claude', name: 'Piper · Claude', description: 'Ligera.', size_mb: 64, is_downloaded: true, is_downloading: false, download_progress: 100 },
  { id: 'kokoro-dora', name: 'Kokoro · Dora', description: 'Expresiva.', size_mb: 334, is_downloaded: false, is_downloading: false, download_progress: 0 },
  { id: 'kokoro-alex', name: 'Kokoro · Alex', description: 'Expresiva.', size_mb: 334, is_downloaded: false, is_downloading: true, download_progress: 40 },
]

beforeEach(() => {
  mockInvoke.mockReset()
  mockInvoke.mockImplementation(async (cmd: string) => (cmd === 'list_voices' ? voices : undefined))
})

describe('VoiceSection', () => {
  it('lista las voces como grupo de opciones y solo deja elegir las descargadas', async () => {
    render(<VoiceSection voice="system" onChange={() => {}} />)
    expect(await screen.findByRole('radio', { name: /Piper · Claude/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /Kokoro · Dora/ })).toBeDisabled()
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('elegir una voz descargada avisa el cambio', async () => {
    const onChange = vi.fn()
    render(<VoiceSection voice="system" onChange={onChange} />)
    await userEvent.click(await screen.findByRole('radio', { name: /Piper · Claude/ }))
    expect(onChange).toHaveBeenCalledWith('piper-claude')
  })

  it('descarga con un boton que dice cual voz y cuanto pesa', async () => {
    render(<VoiceSection voice="system" onChange={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar la voz Kokoro · Dora (mujer)' }))
    expect(mockInvoke).toHaveBeenCalledWith('download_voice', { voiceId: 'kokoro-dora' })
    expect(screen.getByText(/Descarga de 334 MB/)).toBeInTheDocument()
  })

  it('muestra el avance con una barra accesible y permite cancelar', async () => {
    render(<VoiceSection voice="system" onChange={() => {}} />)
    const bar = await screen.findByRole('progressbar', { name: 'Descargando Kokoro · Alex (hombre)' })
    expect(bar).toHaveAttribute('value', '40')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar la descarga de Kokoro · Alex (hombre)' }))
    expect(mockInvoke).toHaveBeenCalledWith('cancel_voice_download', { voiceId: 'kokoro-alex' })
  })

  it('si la voz elegida ya no esta descargada vuelve a la del sistema', async () => {
    const onChange = vi.fn()
    render(<VoiceSection voice="kokoro-dora" onChange={onChange} />)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('system'))
  })

  it('un error al descargar se avisa con role=alert', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_voices') return voices
      throw 'Sin espacio en disco'
    })
    render(<VoiceSection voice="system" onChange={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar la voz Kokoro · Dora (mujer)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin espacio en disco')
  })
})
