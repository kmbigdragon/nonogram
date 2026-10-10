import type { CSSProperties } from 'react'
import { FILLED, createPuzzle, type Cell } from '../game/puzzle.ts'

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
const ROWS = HEART.length
const COLS = HEART[0].length
const PUZZLE = createPuzzle(
  ROWS,
  COLS,
  HEART.flatMap((line) => [...line].map((ch): Cell => (ch === 'X' ? FILLED : 0))),
)

/** A small heart puzzle that solves itself in a loop, cell by cell along the diagonals. */
export function HeroNonogram() {
  return (
    <div className="hero-nono" aria-hidden="true" style={{ '--rows': ROWS, '--cols': COLS } as CSSProperties}>
      <span />
      <div className="hero-cols">
        {PUZZLE.colClues.map((clue, c) => (
          <span key={c}>{clue.join(' ')}</span>
        ))}
      </div>
      <div className="hero-rows">
        {PUZZLE.rowClues.map((clue, r) => (
          <span key={r}>
            {clue.map((n, k) => (
              <b key={k}>{n}</b>
            ))}
          </span>
        ))}
      </div>
      <div className="hero-cells">
        {PUZZLE.solution.map((v, i) => {
          const r = Math.floor(i / COLS)
          const c = i % COLS
          return (
            <span
              key={i}
              className={v === FILLED ? 'is-filled' : 'is-crossed'}
              style={{ '--d': r + c, '--h': 258 + ((r + c) / (ROWS + COLS - 2)) * 77 } as CSSProperties}
            />
          )
        })}
      </div>
    </div>
  )
}
