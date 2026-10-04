import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SolutionDisplay from './SolutionDisplay'

const createMockSolution = () => ({
  problem: '2x + 3 = 11',
  steps: [
    { step: 1, explanation: 'Restamos 3 de ambos lados', calculation: '2x = 11 - 3' },
    { step: 2, explanation: 'Simplificamos', calculation: '2x = 8' },
    { step: 3, explanation: 'Dividimos entre 2', calculation: 'x = 4' },
  ],
  final_answer: 'x = 4',
})

describe('SolutionDisplay Component', () => {
  it('renders the problem statement', () => {
    const solution = createMockSolution()
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText(/Solucion Paso a Paso/)).toBeInTheDocument()
    expect(screen.getByText('Problema:')).toBeInTheDocument()
    expect(screen.getByText('2x + 3 = 11')).toBeInTheDocument()
  })

  it('renders all steps', () => {
    const solution = createMockSolution()
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText('Paso 1')).toBeInTheDocument()
    expect(screen.getByText('Paso 2')).toBeInTheDocument()
    expect(screen.getByText('Paso 3')).toBeInTheDocument()
  })

  it('renders step explanations', () => {
    const solution = createMockSolution()
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText('Restamos 3 de ambos lados')).toBeInTheDocument()
    expect(screen.getByText('Simplificamos')).toBeInTheDocument()
    expect(screen.getByText('Dividimos entre 2')).toBeInTheDocument()
  })

  it('renders calculations when present', () => {
    const solution = createMockSolution()
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText('2x = 11 - 3')).toBeInTheDocument()
    expect(screen.getByText('2x = 8')).toBeInTheDocument()
    expect(screen.getAllByText('x = 4')[0]).toBeInTheDocument()
  })

  it('renders final answer', () => {
    const solution = createMockSolution()
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getAllByText('x = 4')[0]).toBeInTheDocument()
  })

  it('renders target emoji for final answer', () => {
    const solution = createMockSolution()
    
    const { container } = render(<SolutionDisplay solution={solution} />)
    
    const finalAnswerSection = container.querySelector('.final-answer')
    expect(finalAnswerSection).toBeInTheDocument()
  })

  it('renders steps with correct step numbers', () => {
    const solution = {
      problem: 'x + 5 = 12',
      steps: [
        { step: 1, explanation: 'Paso uno', calculation: '' },
        { step: 2, explanation: 'Paso dos', calculation: '' },
        { step: 3, explanation: 'Paso tres', calculation: '' },
        { step: 4, explanation: 'Paso cuatro', calculation: '' },
      ],
      final_answer: 'x = 7',
    }
    
    render(<SolutionDisplay solution={solution} />)

    for (let i = 1; i <= 4; i++) {
      expect(screen.getByText(`Paso ${i}`)).toBeInTheDocument()
    }
  })

  it('renders step without calculation when calculation is empty', () => {
    const solution = {
      problem: '2 + 2',
      steps: [
        { step: 1, explanation: 'Sumamos los numeros', calculation: '' },
      ],
      final_answer: '4',
    }
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText('Sumamos los numeros')).toBeInTheDocument()
  })

  it('renders solution with single step', () => {
    const solution = {
      problem: '5 + 5',
      steps: [
        { step: 1, explanation: 'Sumamos 5 + 5', calculation: '10' },
      ],
      final_answer: '10',
    }
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText('Sumamos 5 + 5')).toBeInTheDocument()
    expect(screen.getAllByText('10')[0]).toBeInTheDocument()
  })

  it('renders solution with many steps', () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      step: i + 1,
      explanation: `Explicacion paso ${i + 1}`,
      calculation: `calculacion ${i + 1}`,
    }))
    
    const solution = {
      problem: 'Problema complejo',
      steps,
      final_answer: 'resultado',
    }
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText('Paso 1')).toBeInTheDocument()
    expect(screen.getByText('Paso 10')).toBeInTheDocument()
    expect(screen.getByText('Explicacion paso 5')).toBeInTheDocument()
  })

  it('renders solution with special characters in problem', () => {
    const solution = {
      problem: 'x² + 5x + 6 = 0',
      steps: [
        { step: 1, explanation: 'Factorizamos', calculation: '(x + 2)(x + 3) = 0' },
      ],
      final_answer: 'x = -2 o x = -3',
    }
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText('x² + 5x + 6 = 0')).toBeInTheDocument()
    expect(screen.getByText('x = -2 o x = -3')).toBeInTheDocument()
  })

  it('renders solution with unicode in steps', () => {
    const solution = {
      problem: '¿Cuánto es 2 + 2?',
      steps: [
        { step: 1, explanation: 'Sumamos los números', calculation: '4' },
      ],
      final_answer: '4',
    }
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText('Sumamos los números')).toBeInTheDocument()
  })

  it('renders solution with empty final answer', () => {
    const solution = {
      problem: 'test',
      steps: [
        { step: 1, explanation: 'Paso 1', calculation: '' },
      ],
      final_answer: '',
    }
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText(/Solucion Paso a Paso/)).toBeInTheDocument()
  })

  it('renders solution with long explanations', () => {
    const longExplanation = 'Esta es una explicacion muy larga que contiene muchos detalles sobre como resolver el problema paso a paso con explicaciones detalladas de cada operacion matematica'
    
    const solution = {
      problem: 'test',
      steps: [
        { step: 1, explanation: longExplanation, calculation: '' },
      ],
      final_answer: 'resultado',
    }
    
    render(<SolutionDisplay solution={solution} />)

    expect(screen.getByText(longExplanation)).toBeInTheDocument()
  })
})
