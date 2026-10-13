import { useT } from '../lib/i18n'

interface SolutionStep {
  step: number
  explanation: string
  title?: string | null
  calculation?: string | null
}

interface Solution {
  problem: string
  steps: SolutionStep[]
  final_answer: string
}

interface SolutionDisplayProps {
  solution: Solution
}

function SolutionDisplay({ solution }: SolutionDisplayProps) {
  const t = useT()
  return (
    <div className="solution-section">
      <h2><span aria-hidden="true">✅</span> {t('solution.heading')}</h2>
      
      <div className="solution-problem">
        <strong>{t('solution.problem')}</strong> {solution.problem}
      </div>

      <div className="solution-steps">
        {solution.steps.map((step, index) => (
          <div key={step.step} className="step" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="step-number">{t('solution.step', { n: step.step })}{step.title ? ` · ${step.title}` : ''}</div>
            <div className="step-explanation">{step.explanation}</div>
            {step.calculation && (
              <div className="step-calculation">{step.calculation}</div>
            )}
          </div>
        ))}
      </div>

      <div className="final-answer">
        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }} aria-hidden="true">🎯</div>
        <div>{solution.final_answer}</div>
      </div>
    </div>
  )
}

export default SolutionDisplay
