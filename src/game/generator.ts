import { getDifficulty, type Difficulty, type DifficultyId } from './difficulty.ts'
import { BLANK, FILLED, createPuzzle, type Cell, type Puzzle } from './puzzle.ts'
import { pick, type Rng } from './random.ts'
import { solveGrid } from './solver.ts'

/** Random picture; mirrored pictures keep the left–right symmetry through repairs. */
function randomPicture(d: Difficulty, symmetric: boolean, rng: Rng): Cell[] {
  const { rows, cols, density } = d
  const cells = new Array<Cell>(rows * cols).fill(BLANK)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (symmetric && c >= Math.ceil(cols / 2)) cells[r * cols + c] = cells[r * cols + (cols - 1 - c)]
      else cells[r * cols + c] = rng() < density ? FILLED : BLANK
    }
  }
  return cells
}

function hasEmptyLine(puzzle: Puzzle): boolean {
  return puzzle.rowClues.some((c) => c.length === 0) || puzzle.colClues.some((c) => c.length === 0)
}

/**
 * Builds a random puzzle that has exactly one solution and can be solved line by line,
 * without guessing. Whenever the line solver stalls, one undecided cell of the picture is
 * flipped (with its mirror twin) to break the ambiguity, and the check runs again.
 */
function generateOne(d: Difficulty, rng: Rng): Puzzle {
  const { rows, cols } = d
  const maxRepairs = rows + cols

  for (let attempt = 0; ; attempt++) {
    const symmetric = rng() < d.symmetry
    const picture = randomPicture(d, symmetric, rng)
    for (let repair = 0; repair <= maxRepairs; repair++) {
      const puzzle = createPuzzle(rows, cols, picture)
      // Empty lines make trivial "0" clues; only tolerate them after many failed tries.
      if (hasEmptyLine(puzzle) && attempt < 20) break
      const result = solveGrid(puzzle)
      if (result.solved) return puzzle
      const undecided: number[] = []
      result.cells.forEach((cell, i) => {
        if (cell === BLANK) undecided.push(i)
      })
      const i = pick(rng, undecided)
      const value: Cell = picture[i] === FILLED ? BLANK : FILLED
      picture[i] = value
      if (symmetric) {
        const r = Math.floor(i / cols)
        picture[r * cols + (cols - 1 - (i % cols))] = value
      }
    }
  }
}

/** Harder levels draw a few candidates and keep the one that needs the most solver sweeps. */
export function generatePuzzle(difficulty: DifficultyId, rng: Rng = Math.random): Puzzle {
  const d = getDifficulty(difficulty)
  let best: Puzzle | null = null
  let bestSweeps = -1
  for (let i = 0; i < d.level; i++) {
    const puzzle = generateOne(d, rng)
    const { sweeps } = solveGrid(puzzle)
    if (sweeps > bestSweeps) {
      best = puzzle
      bestSweeps = sweeps
    }
  }
  return best!
}
