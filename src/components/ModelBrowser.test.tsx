import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModelBrowser from './ModelBrowser'
import { mockInvoke } from '../test-setup'

const createMockModels = () => [
  {
    id: 'model-1',
    name: 'Llama 3.1 8B',
    description: 'Modelo poderoso para matematicas',
    filename: 'llama.gguf',
    size_mb: 4915,
    is_downloaded: true,
    is_downloading: false,
    download_progress: 100,
    is_active: true,
    recommended_for: ['matematicas', 'logica'],
    tags: ['poderoso', '8B', 'Q4'],
  },
  {
    id: 'model-2',
    name: 'Qwen 2.5 3B',
    description: 'Modelo eficiente para aritmetica',
    filename: 'qwen.gguf',
    size_mb: 2048,
    is_downloaded: false,
    is_downloading: false,
    download_progress: 0,
    is_active: false,
    recommended_for: ['aritmetica', 'rapido'],
    tags: ['eficiente', '3B', 'Q4'],
  },
  {
    id: 'model-3',
    name: 'Phi 3.5 Mini',
    description: 'Modelo de Microsoft',
    filename: 'phi.gguf',
    size_mb: 2304,
    is_downloaded: false,
    is_downloading: true,
    download_progress: 45,
    is_active: false,
    recommended_for: ['matematicas', 'ecuaciones'],
    tags: ['microsoft', '3.8B', 'Q4'],
  },
]

describe('ModelBrowser Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockReset()
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {})
    vi.spyOn(globalThis, 'setInterval').mockImplementation((fn: any) => {
      return 1 as any
    })
  })

  it('renders models header and description', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Math Models')).toBeInTheDocument()
    expect(screen.getByText(/select a math model/i)).toBeInTheDocument()
  })

  it('displays downloaded models section', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/Active Model/)).toBeInTheDocument()
    expect(screen.getByText('Llama 3.1 8B')).toBeInTheDocument()
  })

  it('moves the active model to the top of the list', () => {
    const models = createMockModels()
    // model-4 descargado pero inactivo; model-1 activo aunque viene primero en otro orden
    const inactive = { ...models[0], id: 'model-4', name: 'Gemma 2B', is_active: false }
    render(
      <ModelBrowser
        models={[inactive, models[1], models[2], models[0]]}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(names[0]).toBe('Llama 3.1 8B')
    expect(screen.getByText(/Downloaded Models/)).toBeInTheDocument()
  })

  it('displays available models section', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/Available to Download/)).toBeInTheDocument()
    expect(screen.getByText('Qwen 2.5 3B')).toBeInTheDocument()
  })

  it('displays downloading models section', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Phi 3.5 Mini')).toBeInTheDocument()
  })

  it('filters models by search query', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search models/i)
    fireEvent.change(searchInput, { target: { value: 'Qwen' } })

    expect(screen.getByText('Qwen 2.5 3B')).toBeInTheDocument()
    expect(screen.queryByText('Llama 3.1 8B')).not.toBeInTheDocument()
  })

  it('shows active badge on active model', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows select button for downloaded non-active model', () => {
    const models = [
      {
        id: 'model-1',
        name: 'Llama 3.1 8B',
        description: 'Modelo poderoso',
        filename: 'llama.gguf',
        size_mb: 4915,
        is_downloaded: true,
        is_downloading: false,
        download_progress: 100,
        is_active: false,
        recommended_for: ['matematicas'],
        tags: ['poderoso'],
      },
    ]
    
    render(
      <ModelBrowser
        models={models}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const selectButtons = screen.getAllByRole('button', { name: /select/i })
    expect(selectButtons.length).toBeGreaterThan(0)
  })

  it('calls onSelect when select button is clicked', () => {
    const onSelect = vi.fn()
    
    const models = [
      {
        id: 'model-1',
        name: 'Llama 3.1 8B',
        description: 'Modelo poderoso',
        filename: 'llama.gguf',
        size_mb: 4915,
        is_downloaded: true,
        is_downloading: false,
        download_progress: 100,
        is_active: false,
        recommended_for: ['matematicas'],
        tags: ['poderoso'],
      },
    ]
    
    render(
      <ModelBrowser
        models={models}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={onSelect}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const selectButtons = screen.getAllByRole('button', { name: /select/i })
    fireEvent.click(selectButtons[0])

    expect(onSelect).toHaveBeenCalledWith('model-1')
  })

  it('shows delete button for downloaded model', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const deleteButtons = screen.getAllByText(/delete|🗑/i)
    expect(deleteButtons.length).toBeGreaterThan(0)
  })

  it('shows pause and cancel buttons for downloading model', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/Downloading\.\.\./)).toBeInTheDocument()
    expect(screen.getByText(/⏸ pause/i)).toBeInTheDocument()
    expect(screen.getByText(/✕ cancel/i)).toBeInTheDocument()
  })

  it('shows progress bar for downloading model', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/45%/)).toBeInTheDocument()
  })

  it('calls onPause when pause button is clicked', () => {
    const onPause = vi.fn()
    
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={onPause}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const pauseButtons = screen.getAllByText(/pause|⏸/i)
    fireEvent.click(pauseButtons[0])

    expect(onPause).toHaveBeenCalledWith('model-3')
  })

  it('calls onResume when resume button is clicked', () => {
    const onResume = vi.fn()
    
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={onResume}
        onCancel={vi.fn()}
      />
    )

    const resumeButtons = screen.getAllByText(/resume/i)
    if (resumeButtons.length > 0) {
      fireEvent.click(resumeButtons[0])
      expect(onResume).toHaveBeenCalledWith('model-3')
    }
  })

  it('calls onCancel with confirmation when cancel button is clicked', () => {
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)
    const onCancel = vi.fn()
    
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={onCancel}
      />
    )

    const cancelButtons = screen.getAllByText(/cancel|✕/i)
    fireEvent.click(cancelButtons[0])

    expect(window.confirm).toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledWith('model-3')
    
    window.confirm = originalConfirm
  })

  it('does not call onCancel when user cancels confirmation', () => {
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => false)
    const onCancel = vi.fn()
    
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={onCancel}
      />
    )

    const cancelButtons = screen.getAllByText(/cancel|✕/i)
    fireEvent.click(cancelButtons[0])

    expect(window.confirm).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    
    window.confirm = originalConfirm
  })

  it('shows model size in MB', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/4915 MB/)).toBeInTheDocument()
    expect(screen.getByText(/2048 MB/)).toBeInTheDocument()
  })

  it('shows the recommended badge only on the model that fits this PC', () => {
    const models = createMockModels().map(m => ({ ...m, is_recommended: m.id === 'model-2' }))
    render(
      <ModelBrowser
        models={models}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const badges = screen.getAllByText(/Recomendado para tu PC/)
    expect(badges).toHaveLength(1)
    expect(badges[0].closest('.model-card')).toHaveTextContent('Qwen 2.5 3B')
  })

  it('shows model tags', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('poderoso')).toBeInTheDocument()
    expect(screen.getByText('8B')).toBeInTheDocument()
  })

  it('shows empty state when no models match search', () => {
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search models/i)
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

    expect(screen.getByText('No models found')).toBeInTheDocument()
  })

  it('calls onListModels when refresh button is clicked', () => {
    const onListModels = vi.fn()
    
    render(
      <ModelBrowser
        models={createMockModels()}
        onListModels={onListModels}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const refreshButton = screen.getByTitle('Refresh')
    fireEvent.click(refreshButton)

    expect(onListModels).toHaveBeenCalled()
  })

  it('shows published benchmark and speed measured on this PC', () => {
    const models = createMockModels().map(m => m.id === 'model-1'
      ? { ...m, benchmark: 'MATH-Vision 74.6%', tokens_per_second: 123.4 }
      : m)
    render(
      <ModelBrowser
        models={models}
        onListModels={vi.fn()}
        onDownload={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('MATH-Vision 74.6%')).toBeInTheDocument()
    expect(screen.getByText('123 tokens/s')).toBeInTheDocument()
    // Sin datos reales no se inventa nada
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Úsalo para medirla').length).toBeGreaterThan(0)
  })
})
