import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Chalkboard from './Chalkboard'
import { multiplicationScript } from '../lib/board/arithmetic'

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
})
