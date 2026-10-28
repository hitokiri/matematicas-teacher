import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MicSection from './MicSection'
import { mockInvoke } from '../test-setup'

const turbo = {
  id: 'whisper-turbo',
  name: 'Whisper Turbo',
  description: '',
  size_mb: 538,
  is_downloaded: false,
  is_downloading: false,
  download_progress: 0,
}

const small = { ...turbo, id: 'whisper-small', name: 'Whisper Small', size_mb: 610 }

describe('MicSection', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('lista los modelos y descarga el elegido', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => (cmd === 'list_mic_models' ? [turbo, small] : undefined))
    render(<MicSection />)
    expect(await screen.findByText('Whisper Turbo')).toBeInTheDocument()
    expect(screen.getByText('Whisper Small')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Descargar el modelo de voz Whisper Turbo' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('download_mic_model', { modelId: 'whisper-turbo' }))
  })

  it('muestra el progreso mientras descarga y permite cancelar', async () => {
    mockInvoke.mockImplementation(async (cmd: string) =>
      cmd === 'list_mic_models' ? [{ ...turbo, is_downloading: true, download_progress: 45 }] : undefined
    )
    render(<MicSection />)
    expect(await screen.findByRole('progressbar', { name: 'Descargando Whisper Turbo' })).toHaveValue(45)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar descarga de Whisper Turbo' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('cancel_mic_download', { modelId: 'whisper-turbo' }))
  })

  it('borra el modelo solo si se confirma', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockInvoke.mockImplementation(async (cmd: string) =>
      cmd === 'list_mic_models' ? [{ ...turbo, is_downloaded: true }] : undefined
    )
    render(<MicSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar el modelo de voz Whisper Turbo' }))
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('delete_mic_model', { modelId: 'whisper-turbo' }))
    expect(confirm).toHaveBeenCalled()
    confirm.mockRestore()
  })
})
