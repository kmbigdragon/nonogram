/** A cell on the board: blank, filled in, or crossed out (marked as surely empty). */
export const BLANK = 0
export const FILLED = 1
export const CROSSED = 2
export type Cell = typeof BLANK | typeof FILLED | typeof CROSSED

export interface Puzzle {
  rows: number
  cols: number
  /** Row-major, 1 = filled. */
  solution: Cell[]
  rowClues: number[][]
  colClues: number[][]
  /** Number of filled cells in the solution. */
  filledCount: number
}

/** Lengths of the runs of filled cells, e.g. ■■□■ → [2, 1]. An empty line has no runs. */
export function runsOf(line: readonly Cell[]): number[] {
  const runs: number[] = []
  let run = 0
  for (const cell of line) {
    if (cell === FILLED) run++
    else if (run > 0) {
      runs.push(run)
      run = 0
    }
  }
  if (run > 0) runs.push(run)
  return runs
}

export function rowOf<T>(cells: readonly T[], cols: number, r: number): T[] {
  return cells.slice(r * cols, (r + 1) * cols)
}

export function colOf<T>(cells: readonly T[], rows: number, cols: number, c: number): T[] {
  return Array.from({ length: rows }, (_, r) => cells[r * cols + c])
}

export function createPuzzle(rows: number, cols: number, solution: Cell[]): Puzzle {
  return {
    rows,
    cols,
    solution,
    rowClues: Array.from({ length: rows }, (_, r) => runsOf(rowOf(solution, cols, r))),
    colClues: Array.from({ length: cols }, (_, c) => runsOf(colOf(solution, rows, cols, c))),
    filledCount: solution.filter((c) => c === FILLED).length,
  }
}

export function sameRuns(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Which clue numbers are already accounted for by the player's marks.
 * Blocks are matched from each end while they are closed off (by a cross or the border),
 * so a half-finished line still ticks off the clues it has settled.
 */
export function settledClues(clue: readonly number[], line: readonly Cell[]): boolean[] {
  const done = clue.map(() => false)
  if (sameRuns(runsOf(line), clue)) return clue.map(() => true)

  const scan = (cells: readonly Cell[], order: readonly number[]) => {
    let i = 0
    let k = 0
    while (i < cells.length && k < order.length) {
      if (cells[i] === BLANK) return
      if (cells[i] === CROSSED) {
        i++
        continue
      }
      let run = 0
      while (i < cells.length && cells[i] === FILLED) {
        run++
        i++
      }
      // The block must be closed by a cross or the border to count.
      if (i < cells.length && cells[i] !== CROSSED) return
      if (run !== clue[order[k]]) return
      done[order[k]] = true
      k++
    }
  }

  const order = clue.map((_, i) => i)
  scan(line, order)
  scan([...line].reverse(), [...order].reverse())
  return done
}
