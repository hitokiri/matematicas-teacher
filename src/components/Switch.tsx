interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}

/** Interruptor accesible (role=switch) */
export default function Switch({ checked, onChange, label }: SwitchProps) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
}
