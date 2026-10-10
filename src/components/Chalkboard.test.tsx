import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Chalkboard from './Chalkboard'
import { multiplicationScript } from '../lib/board/arithmetic'
import { solutionScript } from '../lib/board/fromSolution'

describe('Chalkboard', () => {
  afterEach(() => vi.useRealTimers())

  it('se reproduce sola paso a paso hasta el resultado', () => {
    vi.useFakeTimers()
    const script = multiplicationScript('10', '20')
    render(<Chalkboard script={script} />)
    expect(screen.getByText(`Paso 1 de ${script.steps.length}`)).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText(`Paso 2 de ${script.steps.length}`)).toBeInTheDocument()

    for (let i = 0; i < script.steps.length; i++) act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText(`Paso ${script.steps.length} de ${script.steps.length}`)).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reproducir/i })).toBeInTheDocument()
  })

  it('los botones avanzan, retroceden y reinician', () => {
    const script = multiplicationScript('10', '20')
    render(<Chalkboard script={script} autoPlay={false} />)
    const next = screen.getByRole('button', { name: /siguiente/i })
    fireEvent.click(next)
    fireEvent.click(next)
    expect(screen.getByText(`Paso 3 de ${script.steps.length}`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
    expect(screen.getByText(`Paso 2 de ${script.steps.length}`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /otra vez/i }))
    expect(screen.getByText(`Paso 1 de ${script.steps.length}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()
  })

  it('dibuja los numeros en la pizarra', () => {
    const script = multiplicationScript('10', '20')
    const { container } = render(<Chalkboard script={script} autoPlay={false} />)
    const texts = [...container.querySelectorAll('text')].map(t => t.textContent)
    expect(texts).toEqual(expect.arrayContaining(['1', '0', '2', '×']))
    expect(container.querySelectorAll('line').length).toBeGreaterThan(0)
  })

  it('una cuenta corta sigue en una sola pizarra', () => {
    const script = multiplicationScript('10', '20')
    const { container } = render(<Chalkboard script={script} autoPlay={false} />)
    expect(container.querySelectorAll('svg.chalkboard').length).toBe(1)
    expect(screen.queryByRole('button', { name: /pizarra \d/i })).not.toBeInTheDocument()
  })

  it('usa la otra parte de la pizarra cuando el proceso es largo', () => {
    const script = solutionScript({
      problem: '2x + 3 = 7',
      steps: Array.from({ length: 12 }, (_, i) => ({
        step: i + 1,
        title: `paso ${i + 1}`,
        explanation: `explicacion ${i + 1}`,
        calculation: `linea ${i + 1}`,
      })),
      final_answer: 'x = 1',
    })
    const { container } = render(<Chalkboard script={script} autoPlay={false} />)
    // Una a la vez: solo se ve la pizarra donde se esta escribiendo
    expect(container.querySelectorAll('svg.chalkboard').length).toBe(1)
    expect(screen.getByRole('button', { name: 'Pizarra 1' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Pizarra 2' })).toBeInTheDocument()

    const next = screen.getByRole('button', { name: /siguiente/i })
    for (let i = 0; i < 8; i++) fireEvent.click(next)
    expect(screen.getByRole('button', { name: 'Pizarra 2' })).toHaveAttribute('aria-current', 'true')
    expect(container.querySelectorAll('svg.chalkboard').length).toBe(1)
    expect(container.querySelector('.chalk-page.active')?.textContent).toContain('linea 8')
  })

  it('un paso final sin renglones se queda en la ultima pizarra', () => {
    const script = solutionScript({
      problem: 'p',
      steps: Array.from({ length: 12 }, (_, i) => ({ step: i + 1, explanation: `e${i}`, calculation: `linea ${i + 1}` })),
      final_answer: 'x = 1',
    })
    script.steps.push({ say: 'fin', add: [] })
    const { container } = render(<Chalkboard script={script} autoPlay={false} />)
    const next = screen.getByRole('button', { name: /siguiente/i })
    for (let i = 0; i < script.steps.length; i++) fireEvent.click(next)
    expect(screen.getByRole('button', { name: 'Pizarra 2' })).toHaveAttribute('aria-current', 'true')
    expect(container.querySelector('.chalk-page.active')?.textContent).toContain('x = 1')
  })

  it('la letra se agranda y achica desde la pizarra', () => {
    const script = solutionScript({ problem: '2x + 3 = 7', steps: [{ step: 1, explanation: 'e', calculation: '2x = 4' }], final_answer: 'x = 2' })
    const onFont = vi.fn()
    const { container, rerender } = render(<Chalkboard script={script} autoPlay={false} fontScale={1} onFontScaleChange={onFont} />)
    const width1 = parseFloat((container.querySelector('svg.chalkboard') as SVGElement).style.width)
    fireEvent.click(screen.getByRole('button', { name: /letra más grande/i }))
    expect(onFont).toHaveBeenCalledWith(1.2)
    fireEvent.click(screen.getByRole('button', { name: /letra más chica/i }))
    expect(onFont).toHaveBeenCalledWith(0.85)

    // Con letra mas grande la pizarra de renglones se dibuja mas grande (no se encoge al ancho)
    rerender(<Chalkboard script={script} autoPlay={false} fontScale={1.4} onFontScaleChange={onFont} />)
    const width2 = parseFloat((container.querySelector('svg.chalkboard') as SVGElement).style.width)
    expect(width2).toBeCloseTo(width1 * 1.4)
    expect(screen.getByRole('button', { name: /letra más grande/i })).toBeDisabled()
  })

  it('muestra todas las pizarras juntas si se pide', () => {
    const script = solutionScript({
      problem: '2x + 3 = 7',
      steps: Array.from({ length: 12 }, (_, i) => ({
        step: i + 1, title: `paso ${i + 1}`, explanation: `explicacion ${i + 1}`, calculation: `linea ${i + 1}`,
      })),
      final_answer: 'x = 1',
    })
    const { container, rerender } = render(<Chalkboard script={script} autoPlay={false} />)
    fireEvent.click(screen.getByRole('button', { name: /ver todas/i }))
    expect(container.querySelectorAll('svg.chalkboard').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /una a la vez/i }))
    expect(container.querySelectorAll('svg.chalkboard').length).toBe(1)

    // La preferencia de la configuracion
    rerender(<Chalkboard script={script} autoPlay={false} showAllPages />)
    expect(container.querySelectorAll('svg.chalkboard').length).toBe(2)
    expect(container.querySelector('.chalk-pages.multi')).toBeInTheDocument()
  })

  it('puede volver a ver una pizarra anterior', () => {
    const script = solutionScript({
      problem: '2x + 3 = 7',
      steps: Array.from({ length: 12 }, (_, i) => ({
        step: i + 1,
        title: `paso ${i + 1}`,
        explanation: `explicacion ${i + 1}`,
        calculation: `linea ${i + 1}`,
      })),
      final_answer: 'x = 1',
    })
    const { container } = render(<Chalkboard script={script} autoPlay={false} />)
    const next = screen.getByRole('button', { name: /siguiente/i })
    for (let i = 0; i < 9; i++) fireEvent.click(next)
    fireEvent.click(screen.getByRole('button', { name: 'Pizarra 1' }))
    expect(screen.getByRole('button', { name: 'Pizarra 1' })).toHaveAttribute('aria-current', 'true')
    expect(container.querySelector('.chalk-page.active')?.textContent).toContain('linea 1')
  })
})
