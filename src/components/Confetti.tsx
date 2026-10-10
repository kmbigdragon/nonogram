import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const COLORS = ['#7b5cff', '#c04dff', '#ff5c9a', '#ffb020', '#22c58b', '#3ba4ff']

export function Confetti({ count = 120 }: { count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.7,
      duration: 2.6 + Math.random() * 2,
      size: 7 + Math.random() * 7,
      drift: (Math.random() - 0.5) * 220,
      spin: 360 + Math.random() * 720,
      color: COLORS[i % COLORS.length],
      round: i % 4 === 0,
    })),
  )

  return createPortal(
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={p.round ? 'is-round' : undefined}
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              '--size': `${p.size}px`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>,
    document.body,
  )
}
