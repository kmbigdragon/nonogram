import { Icon } from './Icon.tsx'
import './Controls.css'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}

export function SwitchRow({ checked, onChange, label, description }: SwitchProps) {
  return (
    <label className="setting-row switch-row">
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {description && <span className="setting-desc">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

interface StepperProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  format: (value: number) => string
  disabled?: boolean
  label: string
}

/** Coarser steps for longer limits: 15s below 2 min, 30s below 10 min, 1 min below 30 min, then 5 min. */
function stepFor(value: number): number {
  return value < 120 ? 15 : value < 600 ? 30 : value < 1800 ? 60 : 300
}

export function Stepper({ value, min, max, onChange, format, disabled, label }: StepperProps) {
  const dec = () => onChange(Math.max(min, value - stepFor(value - 1)))
  const inc = () => onChange(Math.min(max, value + stepFor(value)))
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={dec} disabled={disabled || value <= min} aria-label={`Giảm ${label}`}>
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite">{format(value)}</output>
      <button type="button" onClick={inc} disabled={disabled || value >= max} aria-label={`Tăng ${label}`}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'is-active' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function LevelBars({ level }: { level: number }) {
  return (
    <span className="level-bars" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= level ? 'is-on' : undefined} style={{ height: `${30 + i * 17.5}%` }} />
      ))}
    </span>
  )
}
