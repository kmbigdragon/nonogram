import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { CROSSED, FILLED, colOf, rowOf, settledClues, type Cell, type Puzzle } from '../game/puzzle.ts'
import { HINTED, MISTAKE, type CellFlag } from '../game/state.ts'
import './NonogramBoard.css'

export interface BoardMarks {
  cells: number[]
  tone: 'hint' | 'error'
  line?: { axis: 'row' | 'col'; index: number }
}

interface BoardProps {
  puzzle: Puzzle
  cells: readonly Cell[]
  flags: readonly CellFlag[]
  interactive: boolean
  highlightLines: boolean
  /** Cell under the pointer (or keyboard cursor) whose row and column get tinted. */
  focus: number | null
  cursor: number | null
  marks: BoardMarks | null
  /** Paint the finished picture: grid lines fade and filled cells cascade into a gradient. */
  finish: boolean
  /** Enlarges the cells beyond the fitted size; the board then scrolls. */
  zoom: boolean
  shake: { index: number; key: number } | null
  onStrokeStart: (index: number, cross: boolean) => void
  onStrokeMove: (index: number) => void
  onStrokeEnd: () => void
  onHover: (index: number | null) => void
}

/** Width of the outer grid border, in px; pointer math needs it. */
const BORDER = 2
const MAX_CELL = 60
const MIN_CELL = 12

interface Layout {
  cell: number
  font: number
  rowW: number
  colH: number
}

function layoutFor(puzzle: Puzzle, cell: number): Layout {
  const font = Math.min(24, Math.max(10, Math.round(cell * 0.52)))
  const digit = font * 0.64
  const gap = font * 0.45
  const pad = Math.max(8, cell * 0.4)
  const rowW = Math.max(
    ...puzzle.rowClues.map((clue) =>
      clue.length === 0 ? digit : clue.reduce((w, n) => w + String(n).length * digit, 0) + (clue.length - 1) * gap,
    ),
  )
  const colCount = Math.max(1, ...puzzle.colClues.map((clue) => clue.length))
  return { cell, font, rowW: Math.ceil(rowW + pad), colH: Math.ceil(colCount * font * 1.2 + pad) }
}

/** Largest cell size at which clues and grid fit the space; falls back to scrolling. */
function fitLayout(puzzle: Puzzle, width: number, height: number): Layout {
  for (let cell = MAX_CELL; cell > MIN_CELL; cell--) {
    const l = layoutFor(puzzle, cell)
    if (l.rowW + puzzle.cols * cell + 2 * BORDER <= width && l.colH + puzzle.rows * cell + 2 * BORDER <= height) return l
  }
  return layoutFor(puzzle, MIN_CELL)
}

export function NonogramBoard({
  puzzle,
  cells,
  flags,
  interactive,
  highlightLines,
  focus,
  cursor,
  marks,
  finish,
  zoom,
  shake,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  onHover,
}: BoardProps) {
  const { rows, cols, rowClues, colClues } = puzzle
  const wrapRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<{ id: number; last: number } | null>(null)
  const [layout, setLayout] = useState<Layout>(() => layoutFor(puzzle, 28))

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const update = () => {
      const fit = fitLayout(puzzle, wrap.clientWidth, wrap.clientHeight)
      setLayout(zoom ? layoutFor(puzzle, Math.min(MAX_CELL, Math.max(30, Math.round(fit.cell * 1.6)))) : fit)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [puzzle, zoom])

  const { cell } = layout

  function indexAt(e: PointerEvent, clamp: boolean): number | null {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    let c = Math.floor((e.clientX - rect.left - BORDER) / cell)
    let r = Math.floor((e.clientY - rect.top - BORDER) / cell)
    if (clamp) {
      c = Math.min(cols - 1, Math.max(0, c))
      r = Math.min(rows - 1, Math.max(0, r))
    } else if (c < 0 || r < 0 || c >= cols || r >= rows) {
      return null
    }
    return r * cols + c
  }

  function handleDown(e: PointerEvent<HTMLDivElement>) {
    if (!interactive || pointerRef.current) return
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
    const index = indexAt(e, false)
    if (index === null) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerRef.current = { id: e.pointerId, last: index }
    onHover(index)
    onStrokeStart(index, e.button === 2)
  }

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    const active = pointerRef.current
    if (active && active.id === e.pointerId) {
      const index = indexAt(e, true)
      if (index === null || index === active.last) return
      active.last = index
      onHover(index)
      onStrokeMove(index)
    } else if (!active && e.pointerType === 'mouse') {
      onHover(indexAt(e, false))
    }
  }

  function handleUp(e: PointerEvent<HTMLDivElement>) {
    if (pointerRef.current?.id !== e.pointerId) return
    pointerRef.current = null
    onStrokeEnd()
    if (e.pointerType !== 'mouse') onHover(null)
  }

  const focusRow = focus === null ? -1 : Math.floor(focus / cols)
  const focusCol = focus === null ? -1 : focus % cols
  const markSet = new Set(marks?.cells)
  const lineMarked = (axis: 'row' | 'col', i: number) => marks?.line?.axis === axis && marks.line.index === i

  // Mini preview of the picture so far, drawn in the empty corner.
  const px = Math.floor(Math.min((layout.rowW - 12) / cols, (layout.colH - 12) / rows))
  let preview = ''
  if (px >= 2) {
    cells.forEach((v, i) => {
      if (v === FILLED) preview += `M${(i % cols) * px} ${Math.floor(i / cols) * px}h${px}v${px}h${-px}z`
    })
  }

  const style = {
    '--cell': `${cell}px`,
    '--clue-font': `${layout.font}px`,
    '--row-w': `${layout.rowW}px`,
    '--col-h': `${layout.colH}px`,
    '--rows': rows,
    '--cols': cols,
  } as CSSProperties

  return (
    <div className="nono-wrap" ref={wrapRef}>
      <div className={`nono${finish ? ' is-finish' : ''}`} style={style}>
        <div className="nono-corner" aria-hidden="true">
          {px >= 2 && (
            <svg width={cols * px} height={rows * px} className="nono-preview">
              <rect width={cols * px} height={rows * px} rx={Math.min(4, px)} />
              <path d={preview} />
            </svg>
          )}
        </div>

        <div className="col-clues">
          {colClues.map((clue, c) => {
            const settled = settledClues(clue, colOf(cells, rows, cols, c))
            const done = settled.every(Boolean)
            const cls = ['col-clue']
            if (done) cls.push('is-done')
            if (highlightLines && c === focusCol) cls.push('is-hl')
            if (lineMarked('col', c)) cls.push(`is-mark-${marks!.tone}`)
            if ((c + 1) % 5 === 0 && c < cols - 1) cls.push('sep-r')
            return (
              <div key={c} className={cls.join(' ')}>
                {clue.length === 0 ? (
                  <span className="is-settled">0</span>
                ) : (
                  clue.map((n, k) => (
                    <span key={k} className={settled[k] ? 'is-settled' : undefined}>
                      {n}
                    </span>
                  ))
                )}
              </div>
            )
          })}
        </div>

        <div className="row-clues">
          {rowClues.map((clue, r) => {
            const settled = settledClues(clue, rowOf(cells, cols, r))
            const done = settled.every(Boolean)
            const cls = ['row-clue']
            if (done) cls.push('is-done')
            if (highlightLines && r === focusRow) cls.push('is-hl')
            if (lineMarked('row', r)) cls.push(`is-mark-${marks!.tone}`)
            if ((r + 1) % 5 === 0 && r < rows - 1) cls.push('sep-b')
            return (
              <div key={r} className={cls.join(' ')}>
                {clue.length === 0 ? (
                  <span className="is-settled">0</span>
                ) : (
                  clue.map((n, k) => (
                    <span key={k} className={settled[k] ? 'is-settled' : undefined}>
                      {n}
                    </span>
                  ))
                )}
              </div>
            )
          })}
        </div>

        <div
          ref={gridRef}
          className={`cells${interactive ? ' is-interactive' : ''}`}
          role="application"
          aria-label={`Bảng ${rows}×${cols} ô — phím mũi tên để di chuyển, Space để tô`}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onLostPointerCapture={handleUp}
          onPointerLeave={() => {
            if (!pointerRef.current) onHover(null)
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {cells.map((v, i) => {
            const r = Math.floor(i / cols)
            const c = i % cols
            const cls = ['cell']
            if (v === FILLED) cls.push('is-filled')
            else if (v === CROSSED) cls.push('is-crossed')
            if (flags[i] === MISTAKE) cls.push('is-mistake')
            else if (flags[i] === HINTED) cls.push('is-hinted')
            if (highlightLines && !finish && (r === focusRow || c === focusCol)) cls.push('in-line')
            if (i === focus && interactive) cls.push('is-focus')
            if (i === cursor) cls.push('is-cursor')
            if (markSet.has(i)) cls.push(`is-mark-${marks!.tone}`)
            if (shake?.index === i) cls.push('is-shake')
            if ((c + 1) % 5 === 0 && c < cols - 1) cls.push('sep-r')
            if ((r + 1) % 5 === 0 && r < rows - 1) cls.push('sep-b')
            if (c === cols - 1) cls.push('last-c')
            if (r === rows - 1) cls.push('last-r')
            const cellStyle = finish
              ? ({ '--d': r + c, '--h': 258 + (77 * (r + c)) / Math.max(1, rows + cols - 2) } as CSSProperties)
              : undefined
            return (
              <div
                key={shake?.index === i ? `${i}-${shake.key}` : i}
                className={cls.join(' ')}
                style={cellStyle}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
