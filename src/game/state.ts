import type { DifficultyId } from './difficulty.ts'
import { BLANK, CROSSED, FILLED, colOf, rowOf, runsOf, sameRuns, type Cell, type Puzzle } from './puzzle.ts'

export type GameStatus = 'playing' | 'paused' | 'won' | 'timeout' | 'gaveup'

/** Cells revealed by a mistake check or a hint are locked to the right answer. */
export const FREE = 0
export const MISTAKE = 1
export const HINTED = 2
export type CellFlag = typeof FREE | typeof MISTAKE | typeof HINTED

const HISTORY_LIMIT = 300

export interface GameState {
  puzzle: Puzzle
  difficulty: DifficultyId
  /** null = no time limit. */
  timeLimitMs: number | null
  cells: Cell[]
  flags: CellFlag[]
  past: Cell[][]
  future: Cell[][]
  status: GameStatus
  /** Time banked before the current running stretch. */
  accumulatedMs: number
  /** Timestamp the clock last (re)started, null while stopped. */
  runningSince: number | null
  mistakes: number
  hintCount: number
  undoCount: number
  /** Changes whenever a fresh puzzle or retry starts; used as a React key. */
  round: number
}

export type GameAction =
  | { type: 'commit'; cells: Cell[]; mistakes: number[]; now: number }
  | { type: 'hint'; reveal: { index: number; value: Cell } | null; now: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'timeout'; now: number }
  | { type: 'give-up'; now: number }
  | { type: 'retry'; timeLimitMs: number | null; now: number }
  | { type: 'new-puzzle'; puzzle: Puzzle; timeLimitMs: number | null; now: number }

export function createGame(
  puzzle: Puzzle,
  difficulty: DifficultyId,
  timeLimitMs: number | null,
  now: number,
  round = 0,
): GameState {
  const size = puzzle.rows * puzzle.cols
  return {
    puzzle,
    difficulty,
    timeLimitMs,
    cells: new Array<Cell>(size).fill(BLANK),
    flags: new Array<CellFlag>(size).fill(FREE),
    past: [],
    future: [],
    status: 'playing',
    accumulatedMs: 0,
    runningSince: now,
    mistakes: 0,
    hintCount: 0,
    undoCount: 0,
    round,
  }
}

export function elapsedAt(state: GameState, now: number): number {
  const running = state.runningSince === null ? 0 : Math.max(0, now - state.runningSince)
  return state.accumulatedMs + running
}

/** Solved once the filled cells match the picture; crosses are only notes. */
export function isSolved(puzzle: Puzzle, cells: readonly Cell[]): boolean {
  return puzzle.solution.every((s, i) => (s === FILLED) === (cells[i] === FILLED))
}

/** Marks that contradict the picture: a filled empty cell, or a crossed filled cell. */
export function wrongCells(puzzle: Puzzle, cells: readonly Cell[]): number[] {
  const wrong: number[] = []
  cells.forEach((cell, i) => {
    const filled = puzzle.solution[i] === FILLED
    if ((cell === FILLED && !filled) || (cell === CROSSED && filled)) wrong.push(i)
  })
  return wrong
}

export function lineDone(puzzle: Puzzle, cells: readonly Cell[], axis: 'row' | 'col', index: number): boolean {
  const { rows, cols } = puzzle
  return axis === 'row'
    ? sameRuns(runsOf(rowOf(cells, cols, index)), puzzle.rowClues[index])
    : sameRuns(runsOf(colOf(cells, rows, cols, index)), puzzle.colClues[index])
}

/** Rows and columns that now match their clue but did not before. */
export function newlyDoneLines(puzzle: Puzzle, before: readonly Cell[], after: readonly Cell[]) {
  const lines: { axis: 'row' | 'col'; index: number }[] = []
  const { cols } = puzzle
  const rowsTouched = new Set<number>()
  const colsTouched = new Set<number>()
  after.forEach((cell, i) => {
    if (cell !== before[i]) {
      rowsTouched.add(Math.floor(i / cols))
      colsTouched.add(i % cols)
    }
  })
  for (const r of rowsTouched) {
    if (lineDone(puzzle, after, 'row', r) && !lineDone(puzzle, before, 'row', r)) lines.push({ axis: 'row', index: r })
  }
  for (const c of colsTouched) {
    if (lineDone(puzzle, after, 'col', c) && !lineDone(puzzle, before, 'col', c)) lines.push({ axis: 'col', index: c })
  }
  return lines
}

/**
 * Final cells of a stroke: mistakes flip to the right answer, and (optionally) every
 * row or column the stroke completed gets its remaining blanks crossed out.
 */
export function resolveStroke(
  puzzle: Puzzle,
  before: readonly Cell[],
  drawn: readonly Cell[],
  mistakes: readonly number[],
  autoCross: boolean,
): Cell[] {
  const next = drawn.slice()
  for (const i of mistakes) next[i] = puzzle.solution[i] === FILLED ? FILLED : CROSSED
  if (!autoCross) return next
  const { rows, cols } = puzzle
  for (const { axis, index } of newlyDoneLines(puzzle, before, next)) {
    const count = axis === 'row' ? cols : rows
    for (let k = 0; k < count; k++) {
      const i = axis === 'row' ? index * cols + k : k * cols + index
      if (next[i] === BLANK) next[i] = CROSSED
    }
  }
  return next
}

function stopClock(state: GameState, now: number, status: GameStatus): GameState {
  let accumulatedMs = elapsedAt(state, now)
  if (status === 'timeout' && state.timeLimitMs !== null) accumulatedMs = state.timeLimitMs
  return { ...state, status, accumulatedMs, runningSince: null }
}

/** Applies a history snapshot while keeping locked (mistake or hint) cells as they are. */
function restore(state: GameState, snapshot: Cell[]): Cell[] {
  return snapshot.map((cell, i) => (state.flags[i] === FREE ? cell : state.cells[i]))
}

function withCells(state: GameState, cells: Cell[], now: number): GameState {
  const next = {
    ...state,
    cells,
    past: [...state.past, state.cells].slice(-HISTORY_LIMIT),
    future: [],
  }
  return isSolved(state.puzzle, cells) ? stopClock(next, now, 'won') : next
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const playing = state.status === 'playing'
  switch (action.type) {
    case 'commit': {
      if (!playing) return state
      const cells = action.cells.map((cell, i) => (state.flags[i] === FREE ? cell : state.cells[i]))
      let flags = state.flags
      if (action.mistakes.length > 0) {
        flags = state.flags.slice()
        for (const i of action.mistakes) {
          flags[i] = MISTAKE
          cells[i] = action.cells[i]
        }
      }
      if (flags === state.flags && cells.every((c, i) => c === state.cells[i])) return state
      return withCells({ ...state, flags, mistakes: state.mistakes + action.mistakes.length }, cells, action.now)
    }

    case 'hint': {
      if (!playing) return state
      const counted = { ...state, hintCount: state.hintCount + 1 }
      if (!action.reveal) return counted
      const { index, value } = action.reveal
      const cells = state.cells.slice()
      const flags = state.flags.slice()
      cells[index] = value
      flags[index] = HINTED
      return withCells({ ...counted, flags }, cells, action.now)
    }

    case 'undo': {
      if (!playing || state.past.length === 0) return state
      const snapshot = state.past[state.past.length - 1]
      return {
        ...state,
        cells: restore(state, snapshot),
        past: state.past.slice(0, -1),
        future: [state.cells, ...state.future],
        undoCount: state.undoCount + 1,
      }
    }

    case 'redo': {
      if (!playing || state.future.length === 0) return state
      return {
        ...state,
        cells: restore(state, state.future[0]),
        past: [...state.past, state.cells],
        future: state.future.slice(1),
      }
    }

    case 'clear': {
      if (!playing) return state
      const cells = state.cells.map((cell, i) => (state.flags[i] === FREE ? BLANK : cell))
      if (cells.every((c, i) => c === state.cells[i])) return state
      return { ...state, cells, past: [...state.past, state.cells].slice(-HISTORY_LIMIT), future: [] }
    }

    case 'pause':
      return playing ? stopClock(state, action.now, 'paused') : state

    case 'resume':
      return state.status === 'paused' ? { ...state, status: 'playing', runningSince: action.now } : state

    case 'timeout':
      return playing ? stopClock(state, action.now, 'timeout') : state

    case 'give-up':
      return playing || state.status === 'paused' ? stopClock(state, action.now, 'gaveup') : state

    case 'retry':
      return createGame(state.puzzle, state.difficulty, action.timeLimitMs, action.now, state.round + 1)

    case 'new-puzzle':
      return createGame(action.puzzle, state.difficulty, action.timeLimitMs, action.now, state.round + 1)
  }
}
