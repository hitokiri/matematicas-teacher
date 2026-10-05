import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Settings from '../pages/Settings'
import { mockInvoke } from '../test-setup'

const createMockModels = () => [
  {
    id: 'model-1',
    name: 'Llama 3.1 8B',
    description: 'Modelo poderoso',
    filename: 'llama.gguf',
    size_mb: 4915,
    is_downloaded: true,
    is_downloading: false,
    download_progress: 100,
    is_active: true,
    recommended_for: ['matematicas'],
    tags: ['poderoso'],
  },
  {
    id: 'model-2',
    name: 'Qwen 2.5 3B',
    description: 'Modelo eficiente',
    filename: 'qwen.gguf',
    size_mb: 2048,
    is_downloaded: false,
    is_downloading: false,
    download_progress: 0,
    is_active: false,
    recommended_for: ['aritmetica'],
    tags: ['eficiente'],
  },
]

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockReset()
  })

  it('renders settings modal with only local models', async () => {
    mockInvoke.mockResolvedValue(createMockModels())
    const onCancel = vi.fn()
    
    render(
      <Settings
        onCancel={onCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })

    expect(screen.getByText(/Hardware del modelo local/)).toBeInTheDocument()
    // Solo modelos locales: sin proveedores en la nube ni boton de guardar
    expect(screen.queryByText(/OpenAI/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Anthropic/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument()
  })

  it('shows the hardware used by the local model', async () => {
    mockInvoke.mockImplementation(async (cmd: string) =>
      cmd === 'get_compute_device' ? 'GPU: NVIDIA GeForce RTX 5070 Ti' : createMockModels()
    )

    render(<Settings onCancel={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('GPU: NVIDIA GeForce RTX 5070 Ti')).toBeInTheDocument()
    })
  })

  it('calls onCancel when back button is clicked', async () => {
    mockInvoke.mockResolvedValue(createMockModels())
    const onCancel = vi.fn()
    
    render(
      <Settings
        onCancel={onCancel}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })

    const backButton = screen.getByText(/volver/i)
    fireEvent.click(backButton)

    expect(onCancel).toHaveBeenCalled()
  })

  it('displays models list from API', async () => {
    mockInvoke.mockResolvedValue(createMockModels())
    
    render(
      <Settings
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Llama 3.1 8B')).toBeInTheDocument()
    })

    expect(screen.getByText('Qwen 2.5 3B')).toBeInTheDocument()
  })

  it('calls onSelect when select button is clicked', async () => {
    mockInvoke.mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'list_models') {
        // modelo descargado pero inactivo para que aparezca el boton Select
        return createMockModels().map(m => ({ ...m, is_active: false }))
      }
      if (cmd === 'select_model') {
        return undefined
      }
    })
    
    render(
      <Settings
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })

    const selectButtons = await screen.findAllByRole('button', { name: /select/i })
    if (selectButtons.length > 0) {
      fireEvent.click(selectButtons[0])
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('select_model', expect.any(Object))
      })
    }
  })

  it('calls onDelete with confirmation when delete button is clicked', async () => {
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)
    
    mockInvoke.mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'list_models') {
        return createMockModels()
      }
      if (cmd === 'delete_model') {
        return undefined
      }
    })
    
    render(
      <Settings
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByText(/delete|🗑/i)
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
      
      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled()
        expect(mockInvoke).toHaveBeenCalledWith('delete_model', expect.any(Object))
      })
    }
    
    window.confirm = originalConfirm
  })

  it('cancels delete when user confirms no', async () => {
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => false)
    
    mockInvoke.mockResolvedValue(createMockModels())
    
    render(
      <Settings
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByText(/delete|🗑/i)
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
      
      expect(window.confirm).toHaveBeenCalled()
      expect(mockInvoke).not.toHaveBeenCalledWith('delete_model', expect.any(Object))
    }
    
    window.confirm = originalConfirm
  })

  it('calls onPause when pause button is clicked', async () => {
    const downloadingModels = [
      ...createMockModels(),
      {
        id: 'model-3',
        name: 'Phi 3.5',
        description: 'Modelo Microsoft',
        filename: 'phi.gguf',
        size_mb: 2304,
        is_downloaded: false,
        is_downloading: true,
        download_progress: 45,
        is_active: false,
        recommended_for: ['matematicas'],
        tags: ['microsoft'],
      },
    ]
    
    mockInvoke.mockResolvedValue(downloadingModels)
    
    render(
      <Settings
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })

    const pauseButtons = screen.getAllByText(/pause|⏸/i)
    if (pauseButtons.length > 0) {
      fireEvent.click(pauseButtons[0])
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('pause_download', expect.any(Object))
      })
    }
  })

  it('calls onResume when resume button is clicked', async () => {
    const pausedModels = [
      ...createMockModels(),
      {
        id: 'model-3',
        name: 'Phi 3.5',
        description: 'Modelo Microsoft',
        filename: 'phi.gguf',
        size_mb: 2304,
        is_downloaded: false,
        is_downloading: true,
        download_progress: 45,
        is_active: false,
        recommended_for: ['matematicas'],
        tags: ['microsoft'],
      },
    ]
    
    mockInvoke.mockResolvedValue(pausedModels)
    
    render(
      <Settings
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })

    const resumeButtons = screen.getAllByText(/resume/i)
    if (resumeButtons.length > 0) {
      fireEvent.click(resumeButtons[0])
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('resume_download', expect.any(Object))
      })
    }
  })

  it('calls onCancelDownload when cancel button is clicked', async () => {
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)
    
    const downloadingModels = [
      ...createMockModels(),
      {
        id: 'model-3',
        name: 'Phi 3.5',
        description: 'Modelo Microsoft',
        filename: 'phi.gguf',
        size_mb: 2304,
        is_downloaded: false,
        is_downloading: true,
        download_progress: 45,
        is_active: false,
        recommended_for: ['matematicas'],
        tags: ['microsoft'],
      },
    ]
    
    mockInvoke.mockResolvedValue(downloadingModels)
    
    render(
      <Settings
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })

    const cancelButtons = screen.getAllByText(/cancel|✕/i)
    if (cancelButtons.length > 0) {
      fireEvent.click(cancelButtons[0])
      
      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled()
        expect(mockInvoke).toHaveBeenCalledWith('cancel_download', expect.any(Object))
      })
    }
    
    window.confirm = originalConfirm
  })

})
