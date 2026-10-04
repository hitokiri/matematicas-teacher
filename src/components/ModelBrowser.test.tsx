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

    expect(screen.getByText(/Downloaded Models/)).toBeInTheDocument()
    expect(screen.getByText('Llama 3.1 8B')).toBeInTheDocument()
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

  it('shows recommended badge for non-downloaded models', () => {
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

    expect(screen.getAllByText('Recommended')[0]).toBeInTheDocument()
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

  it('renders metrics bars for accuracy and speed', () => {
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

    expect(screen.getAllByText('accuracy')[0]).toBeInTheDocument()
    expect(screen.getAllByText('speed')[0]).toBeInTheDocument()
  })
})
