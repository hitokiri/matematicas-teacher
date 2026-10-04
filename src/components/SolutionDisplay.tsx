interface SolutionStep {
  step: number
  explanation: string
  calculation: string
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
  return (
    <div className="solution-section">
      <h2>✅ Solucion Paso a Paso</h2>
      
      <div className="solution-problem">
        <strong>Problema:</strong> {solution.problem}
      </div>

      <div className="solution-steps">
        {solution.steps.map((step, index) => (
          <div key={step.step} className="step" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="step-number">Paso {step.step}</div>
            <div className="step-explanation">{step.explanation}</div>
            {step.calculation && (
              <div className="step-calculation">{step.calculation}</div>
            )}
          </div>
        ))}
      </div>

      <div className="final-answer">
        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🎯</div>
        <div>{solution.final_answer}</div>
      </div>
    </div>
  )
}

export default SolutionDisplay
