import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'
import { mockInvoke } from './test-setup'

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockReset()
    window.localStorage.clear()
  })

  it('renders the app header', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Matematicas Teacher' })).toBeInTheDocument()
    })
  })

  it('renders settings button', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('⚙️ Configuracion')).toBeInTheDocument()
    })
  })

  it('renders theme toggle button', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTitle('Modo oscuro')).toBeInTheDocument()
    })
  })

  it('renders MainApp component', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Escribe o dibuja tu problema matematico')).toBeInTheDocument()
    })
  })

  it('opens settings modal when settings button is clicked', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('⚙️ Configuracion')).toBeInTheDocument()
    })

    const settingsButton = screen.getByText('⚙️ Configuracion')
    fireEvent.click(settingsButton)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuración/ })).toBeInTheDocument()
    })
  })

  it('loads settings from Tauri on mount', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'openai',
      openai_key: 'sk-test-key',
      anthropic_key: '',
      active_model_id: 'model-1',
    })
    
    render(<App />)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_settings')
    })
  })

  it('handles settings load error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to load settings'))
    
    const consoleError = console.error
    console.error = vi.fn()
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Matematicas Teacher' })).toBeInTheDocument()
    })

    console.error = consoleError
  })

  it('toggles theme when theme toggle is clicked', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTitle('Modo oscuro')).toBeInTheDocument()
    })

    const themeToggle = screen.getByTitle('Modo oscuro')
    fireEvent.click(themeToggle)

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'dark')
    })
  })

  it('sets data-theme attribute on html element', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    const themeToggle = screen.getByTitle('Modo oscuro')
    fireEvent.click(themeToggle)

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  it('shows loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}))
    
    render(<App />)

    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('renders input section with text and draw tabs', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('✏️ Texto')).toBeInTheDocument()
      expect(screen.getByText('🎨 Dibujar')).toBeInTheDocument()
    })
  })

  it('renders problem input textarea', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ejemplo/i)).toBeInTheDocument()
    })
  })

  it('renders solve problem button', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('🚀 Resolver Problema')).toBeInTheDocument()
    })
  })

  it('disables solve button when problem text is empty', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('🚀 Resolver Problema')).toBeInTheDocument()
    })

    const solveButton = screen.getByText('🚀 Resolver Problema')
    expect(solveButton).toBeDisabled()
  })

  it('enables solve button when problem text is entered', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('🚀 Resolver Problema')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText(/ejemplo/i)
    fireEvent.change(textarea, { target: { value: '2 + 2' } })

    const solveButton = screen.getByText('🚀 Resolver Problema')
    expect(solveButton).not.toBeDisabled()
  })

  it('uses dark theme when localStorage has dark theme', async () => {
    window.localStorage.setItem('theme', 'dark')
    
    mockInvoke.mockResolvedValue({
      provider: 'local',
      openai_key: '',
      anthropic_key: '',
      active_model_id: null,
    })
    
    render(<App />)

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    const themeToggle = screen.getByTitle('Modo claro')
    expect(themeToggle).toBeInTheDocument()
  })
})
