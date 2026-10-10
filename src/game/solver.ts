import { BLANK, CROSSED, FILLED, colOf, rowOf, type Cell, type Puzzle } from './puzzle.ts'

/**
 * Line solver: given one line's clue and what is known so far (BLANK = unknown,
 * FILLED, CROSSED = known empty), returns the line with every cell that holds the
 * same value in all valid arrangements filled in, or null if no arrangement fits.
 */
export function solveLine(clue: readonly number[], line: readonly Cell[]): Cell[] | null {
  const n = line.length
  const k = clue.length
  const W = n + 1

  const crossedBefore = new Int32Array(n + 1)
  for (let i = 0; i < n; i++) crossedBefore[i + 1] = crossedBefore[i] + (line[i] === CROSSED ? 1 : 0)
  const noCross = (from: number, to: number) => crossedBefore[to] === crossedBefore[from]
  const canBeEmpty = (i: number) => line[i] !== FILLED

  // pre[j][i]: cells [0, i) can hold exactly blocks 0..j-1.
  const pre = new Uint8Array((k + 1) * W)
  pre[0] = 1
  for (let i = 1; i <= n; i++) pre[i] = pre[i - 1] && canBeEmpty(i - 1) ? 1 : 0
  for (let j = 1; j <= k; j++) {
    const len = clue[j - 1]
    for (let i = 1; i <= n; i++) {
      let ok = pre[j * W + i - 1] === 1 && canBeEmpty(i - 1)
      if (!ok && i >= len && noCross(i - len, i)) {
        const s = i - len
        ok = s === 0 ? j === 1 : canBeEmpty(s - 1) && pre[(j - 1) * W + s - 1] === 1
      }
      pre[j * W + i] = ok ? 1 : 0
    }
  }
  if (!pre[k * W + n]) return null

  // suf[j][i]: cells [i, n) can hold exactly blocks j..k-1.
  const suf = new Uint8Array((k + 1) * W)
  suf[k * W + n] = 1
  for (let i = n - 1; i >= 0; i--) suf[k * W + i] = suf[k * W + i + 1] && canBeEmpty(i) ? 1 : 0
  for (let j = k - 1; j >= 0; j--) {
    const len = clue[j]
    for (let i = n - 1; i >= 0; i--) {
      let ok = suf[j * W + i + 1] === 1 && canBeEmpty(i)
      if (!ok && i + len <= n && noCross(i, i + len)) {
        const e = i + len
        ok = e === n ? j === k - 1 : canBeEmpty(e) && suf[(j + 1) * W + e + 1] === 1
      }
      suf[j * W + i] = ok ? 1 : 0
    }
  }

  // Cells some valid arrangement covers with a block.
  const cover = new Int32Array(n + 1)
  for (let j = 0; j < k; j++) {
    const len = clue[j]
    for (let s = 0; s + len <= n; s++) {
      const e = s + len
      if (!noCross(s, e)) continue
      const left = s === 0 ? j === 0 : canBeEmpty(s - 1) && pre[j * W + s - 1] === 1
      if (!left) continue
      const right = e === n ? j === k - 1 : canBeEmpty(e) && suf[(j + 1) * W + e + 1] === 1
      if (!right) continue
      cover[s]++
      cover[e]--
    }
  }

  const out = line.slice()
  let covered = 0
  for (let i = 0; i < n; i++) {
    covered += cover[i]
    if (line[i] !== BLANK) continue
    let empty = false
    for (let j = 0; j <= k && !empty; j++) empty = pre[j * W + i] === 1 && suf[j * W + i + 1] === 1
    const fill = covered > 0
    if (fill && !empty) out[i] = FILLED
    else if (empty && !fill) out[i] = CROSSED
    else if (!fill && !empty) return null
  }
  return out
}

export interface GridSolve {
  /** BLANK where the line solver could not decide. */
  cells: Cell[]
  solved: boolean
  contradiction: boolean
  /** Alternating row/column sweeps needed; a rough measure of difficulty. */
  sweeps: number
}

/** Repeats the line solver over rows and columns until nothing more can be deduced. */
export function solveGrid(puzzle: Puzzle, start?: readonly Cell[]): GridSolve {
  const { rows, cols, rowClues, colClues } = puzzle
  const cells = start ? start.slice() : new Array<Cell>(rows * cols).fill(BLANK)
  const dirtyRows = new Array<boolean>(rows).fill(true)
  const dirtyCols = new Array<boolean>(cols).fill(true)
  let sweeps = 0

  for (let pending = true; pending; ) {
    pending = false
    sweeps++
    for (let r = 0; r < rows; r++) {
      if (!dirtyRows[r]) continue
      dirtyRows[r] = false
      const line = rowOf(cells, cols, r)
      const next = solveLine(rowClues[r], line)
      if (!next) return { cells, solved: false, contradiction: true, sweeps }
      for (let c = 0; c < cols; c++) {
        if (next[c] !== line[c]) {
          cells[r * cols + c] = next[c]
          dirtyCols[c] = true
          pending = true
        }
      }
    }
    for (let c = 0; c < cols; c++) {
      if (!dirtyCols[c]) continue
      dirtyCols[c] = false
      const line = colOf(cells, rows, cols, c)
      const next = solveLine(colClues[c], line)
      if (!next) return { cells, solved: false, contradiction: true, sweeps }
      for (let r = 0; r < rows; r++) {
        if (next[r] !== line[r]) {
          cells[r * cols + c] = next[r]
          dirtyRows[r] = true
          pending = true
        }
      }
    }
  }

  return { cells, solved: cells.every((c) => c !== BLANK), contradiction: false, sweeps }
}

export interface Deduction {
  axis: 'row' | 'col'
  index: number
  /** Cells (board indices) the clue of that line settles, with their value. */
  cells: { index: number; value: Cell }[]
}

/**
 * The line with the most cells that can be deduced from the player's current marks.
 * Assumes the marks are correct; returns null when no single line gives anything new.
 */
export function findDeduction(puzzle: Puzzle, board: readonly Cell[]): Deduction | null {
  const { rows, cols, rowClues, colClues } = puzzle
  let best: Deduction | null = null
  const consider = (axis: 'row' | 'col', index: number, line: Cell[], toBoard: (i: number) => number) => {
    const clue = axis === 'row' ? rowClues[index] : colClues[index]
    const next = solveLine(clue, line)
    if (!next) return
    const cells: Deduction['cells'] = []
    for (let i = 0; i < line.length; i++) {
      if (next[i] !== line[i]) cells.push({ index: toBoard(i), value: next[i] })
    }
    if (cells.length > 0 && (!best || cells.length > best.cells.length)) best = { axis, index, cells }
  }
  for (let r = 0; r < rows; r++) consider('row', r, rowOf(board, cols, r), (c) => r * cols + c)
  for (let c = 0; c < cols; c++) consider('col', c, colOf(board, rows, cols, c), (r) => r * cols + c)
  return best
}
