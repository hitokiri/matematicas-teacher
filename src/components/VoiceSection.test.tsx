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
    render(<VoiceSection voice="system" onChange={() => {}} readAloud={false} onReadAloudChange={() => {}} />)
    expect(await screen.findByRole('radio', { name: /Piper · Claude/ })).toBeEnabled()
    // Las no descargadas se pueden elegir: se descargan y se activan solas
    expect(screen.getByRole('radio', { name: /Kokoro · Dora/ })).toBeEnabled()
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('elegir una voz descargada avisa el cambio', async () => {
    const onChange = vi.fn()
    render(<VoiceSection voice="system" onChange={onChange} readAloud={false} onReadAloudChange={() => {}} />)
    await userEvent.click(await screen.findByRole('radio', { name: /Piper · Claude/ }))
    expect(onChange).toHaveBeenCalledWith('piper-claude')
  })

  it('descarga con un boton que dice cual voz y cuanto pesa', async () => {
    render(<VoiceSection voice="system" onChange={() => {}} readAloud={false} onReadAloudChange={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar la voz Kokoro · Dora (mujer)' }))
    expect(mockInvoke).toHaveBeenCalledWith('download_voice', { voiceId: 'kokoro-dora' })
    expect(screen.getAllByText(/Al elegirla se descarga \(334 MB\)/).length).toBeGreaterThan(0)
  })

  it('muestra el avance con una barra accesible y permite cancelar', async () => {
    render(<VoiceSection voice="system" onChange={() => {}} readAloud={false} onReadAloudChange={() => {}} />)
    const bar = await screen.findByRole('progressbar', { name: 'Descargando Kokoro · Alex (hombre)' })
    expect(bar).toHaveAttribute('value', '40')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar la descarga de Kokoro · Alex (hombre)' }))
    expect(mockInvoke).toHaveBeenCalledWith('cancel_voice_download', { voiceId: 'kokoro-alex' })
  })

  it('si la voz elegida ya no esta descargada vuelve a la del sistema', async () => {
    const onChange = vi.fn()
    render(<VoiceSection voice="kokoro-dora" onChange={onChange} readAloud={false} onReadAloudChange={() => {}} />)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('system'))
  })

  it('un error al descargar se avisa con role=alert', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_voices') return voices
      throw 'Sin espacio en disco'
    })
    render(<VoiceSection voice="system" onChange={() => {}} readAloud={false} onReadAloudChange={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar la voz Kokoro · Dora (mujer)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin espacio en disco')
  })

  it('el interruptor de lectura en voz alta avisa el cambio', async () => {
    const onReadAloudChange = vi.fn()
    render(<VoiceSection voice="system" onChange={() => {}} readAloud={false} onReadAloudChange={onReadAloudChange} />)
    const sw = await screen.findByRole('switch', { name: 'Leer la explicación en voz alta' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(onReadAloudChange).toHaveBeenCalledWith(true)
  })

  it('elegir una voz sin descargar la descarga y la activa sola al terminar', async () => {
    const onChange = vi.fn()
    let downloaded = false
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'download_voice') { downloaded = true; return undefined }
      if (cmd !== 'list_voices') return undefined
      return voices.map(v => (v.id === 'kokoro-dora' ? { ...v, is_downloaded: downloaded, is_downloading: false } : v))
    })
    render(<VoiceSection voice="piper-claude" onChange={onChange} readAloud={false} onReadAloudChange={() => {}} />)
    await userEvent.click(await screen.findByRole('radio', { name: /Kokoro · Dora/ }))
    expect(mockInvoke).toHaveBeenCalledWith('download_voice', { voiceId: 'kokoro-dora' })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('kokoro-dora'))
  })

  it('la voz del sistema que falta explica que instalar, con el comando de la distribucion', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_voices') return voices
      if (cmd === 'get_system_voice') return { available: false, engine: null, os: 'Ubuntu 24.04.5 LTS', install_command: 'sudo apt install espeak-ng' }
      return undefined
    })
    render(<VoiceSection voice="piper-claude" onChange={() => {}} readAloud={false} onReadAloudChange={() => {}} />)
    expect(await screen.findByText(/Todavía no disponible en tu computadora/)).toBeInTheDocument()
    expect(screen.getByText(/Ubuntu 24\.04\.5 LTS/)).toBeInTheDocument()
    expect(screen.getByText('sudo apt install espeak-ng')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Voz del sistema/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /copiar comando/i }))
    expect(writeText).toHaveBeenCalledWith('sudo apt install espeak-ng')
  })

  it('«Volver a comprobar» detecta lo recien instalado y habilita la voz del sistema', async () => {
    let installed = false
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_voices') return voices
      if (cmd === 'get_system_voice') {
        return installed
          ? { available: true, engine: 'espeak-ng', os: 'Ubuntu', install_command: null }
          : { available: false, engine: null, os: 'Ubuntu', install_command: 'sudo apt install espeak-ng' }
      }
      return undefined
    })
    const onChange = vi.fn()
    render(<VoiceSection voice="piper-claude" onChange={onChange} readAloud={false} onReadAloudChange={() => {}} />)
    await screen.findByText('sudo apt install espeak-ng')
    installed = true
    await userEvent.click(screen.getByRole('button', { name: /volver a comprobar/i }))
    const radio = await screen.findByRole('radio', { name: /Voz del sistema/ })
    await waitFor(() => expect(radio).toBeEnabled())
    expect(screen.queryByText('sudo apt install espeak-ng')).not.toBeInTheDocument()
    expect(screen.getByText('Usa espeak-ng.')).toBeInTheDocument()
    await userEvent.click(radio)
    expect(onChange).toHaveBeenCalledWith('system')
  })
})
