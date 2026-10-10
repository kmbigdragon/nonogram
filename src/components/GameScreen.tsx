import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react'
import type { DifficultyId } from '../game/difficulty.ts'
import { generatePuzzle } from '../game/generator.ts'
import { BLANK, CROSSED, FILLED, type Cell } from '../game/puzzle.ts'
import { findDeduction } from '../game/solver.ts'
import { playSound, type SoundName } from '../game/sound.ts'
import {
  FREE,
  createGame,
  elapsedAt,
  gameReducer,
  isSolved,
  newlyDoneLines,
  resolveStroke,
  wrongCells,
} from '../game/state.ts'
import { recordPlayed, recordWin, timeLimitMs, type Settings } from '../game/storage.ts'
import { useNow } from '../hooks/useNow.ts'
import { Hud } from './Hud.tsx'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'
import { NonogramBoard, type BoardMarks } from './NonogramBoard.tsx'
import { ResultModal, type WinInfo } from './ResultModal.tsx'
import { RulesModal } from './RulesModal.tsx'
import { SettingsModal } from './SettingsModal.tsx'
import './GameScreen.css'

interface GameScreenProps {
  difficulty: DifficultyId
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onHome: () => void
}

type Overlay = 'settings' | 'rules' | 'leave' | null
type ToastTone = 'info' | 'error' | 'hint'
type Tool = 'fill' | 'cross'

interface Toast {
  id: number
  text: string
  tone: ToastTone
}

/** An in-progress drag: a straight run of cells from `start`, redrawn from `base` on every move. */
interface Stroke {
  start: number
  base: Cell[]
  value: Cell
  erase: boolean
  axis: 'row' | 'col' | null
  drawn: Cell[]
}

function starRating(hints: number, mistakes: number): number {
  let stars = 3
  if (hints > 0) stars--
  if (mistakes > 2) stars--
  return Math.max(1, stars)
}

const lineName = (axis: 'row' | 'col', index: number) => `${axis === 'row' ? 'Hàng' : 'Cột'} ${index + 1}`

export function GameScreen({ difficulty, settings, onSettingsChange, onHome }: GameScreenProps) {
  const [game, dispatch] = useReducer(gameReducer, difficulty, (d) =>
    createGame(generatePuzzle(d), d, timeLimitMs(settings, d), Date.now()),
  )
  const [tool, setTool] = useState<Tool>('fill')
  const [draft, setDraft] = useState<Cell[] | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [marks, setMarks] = useState<BoardMarks | null>(null)
  const [shake, setShake] = useState<{ index: number; key: number } | null>(null)
  const [win, setWin] = useState<WinInfo | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [resumeOnClose, setResumeOnClose] = useState(false)
  const strokeRef = useRef<Stroke | null>(null)

  const { puzzle, cells, flags, status } = game
  const { rows, cols } = puzzle
  const now = useNow(status === 'playing')
  const elapsed = elapsedAt(game, now)
  const remainingMs = game.timeLimitMs === null ? null : game.timeLimitMs - elapsed
  const playing = status === 'playing'
  const over = status === 'won' || status === 'timeout' || status === 'gaveup'
  const shownCells = showSolution ? puzzle.solution : (draft ?? cells)
  const filledCount = (draft ?? cells).filter((c) => c === FILLED).length

  const sfx = (name: SoundName, progress?: number) => {
    if (settings.sound) playSound(name, progress)
  }
  const notify = (text: string, tone: ToastTone = 'info') => setToast({ id: Date.now(), text, tone })

  // ------------------------------------------------------------ timed effects

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), toast.tone === 'error' ? 2400 : 4600)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!marks) return
    const id = setTimeout(() => setMarks(null), 5000)
    return () => clearTimeout(id)
  }, [marks])

  useEffect(() => {
    if (!shake) return
    const id = setTimeout(() => setShake(null), 450)
    return () => clearTimeout(id)
  }, [shake])

  // Let the picture reveal play before the result card covers it.
  useEffect(() => {
    if (status !== 'won') return
    const id = setTimeout(() => setResultOpen(true), 1500)
    return () => clearTimeout(id)
  }, [status])

  const onTimeUp = useEffectEvent(() => {
    strokeRef.current = null
    setDraft(null)
    dispatch({ type: 'timeout', now: Date.now() })
    setMarks(null)
    setResultOpen(true)
    sfx('lose')
  })
  const { timeLimitMs: limit, runningSince, accumulatedMs } = game
  useEffect(() => {
    if (limit === null || runningSince === null) return
    const left = limit - accumulatedMs - (Date.now() - runningSince)
    const id = setTimeout(onTimeUp, Math.max(0, left))
    return () => clearTimeout(id)
  }, [limit, runningSince, accumulatedMs])

  const onTick = useEffectEvent(() => sfx('tick'))
  const secondsLeft = remainingMs === null ? null : Math.ceil(remainingMs / 1000)
  useEffect(() => {
    if (playing && secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 10) onTick()
  }, [playing, secondsLeft])

  // Pause when the tab is hidden so the clock is fair.
  const onHidden = useEffectEvent(() => {
    if (game.status === 'playing') {
      endStroke()
      dispatch({ type: 'pause', now: Date.now() })
    }
  })
  useEffect(() => {
    const handler = () => {
      if (document.hidden) onHidden()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // ------------------------------------------------------------ painting

  function strokeCells(s: Stroke, target: number): number[] {
    const sr = Math.floor(s.start / cols)
    const sc = s.start % cols
    const tr = Math.floor(target / cols)
    const tc = target % cols
    if (target === s.start) {
      s.axis = null
      return [s.start]
    }
    // Lock to the row or column the drag first heads along.
    s.axis ??= Math.abs(tr - sr) > Math.abs(tc - sc) ? 'col' : 'row'
    const out: number[] = []
    if (s.axis === 'row') {
      const step = tc >= sc ? 1 : -1
      for (let c = sc; ; c += step) {
        out.push(sr * cols + c)
        if (c === tc) break
      }
    } else {
      const step = tr >= sr ? 1 : -1
      for (let r = sr; ; r += step) {
        out.push(r * cols + sc)
        if (r === tr) break
      }
    }
    return out
  }

  /** Redraws the stroke up to `target`; returns the first wrong cell when mistakes are checked. */
  function drawStroke(s: Stroke, target: number): number | null {
    const next = s.base.slice()
    let mistake: number | null = null
    for (const i of strokeCells(s, target)) {
      if (flags[i] !== FREE) continue
      if (s.erase) {
        if (s.base[i] === s.value) next[i] = BLANK
        continue
      }
      // Painting only claims blank cells, except the cell the drag started on.
      if (i !== s.start && s.base[i] !== BLANK) continue
      if (settings.checkMistakes && (puzzle.solution[i] === FILLED) !== (s.value === FILLED)) {
        mistake = i
        break
      }
      next[i] = s.value
    }
    s.drawn = next
    return mistake
  }

  function startStroke(index: number, cross: boolean) {
    if (!playing) return
    const value: Cell = cross || tool === 'cross' ? CROSSED : FILLED
    const s: Stroke = {
      start: index,
      base: cells,
      value,
      erase: cells[index] === value && flags[index] === FREE,
      axis: null,
      drawn: cells,
    }
    strokeRef.current = s
    moveStroke(index)
  }

  function moveStroke(target: number) {
    const s = strokeRef.current
    if (!s || !playing) return
    const mistake = drawStroke(s, target)
    if (mistake !== null) commitStroke(s, mistake)
    else setDraft(s.drawn)
  }

  function endStroke() {
    const s = strokeRef.current
    if (s) commitStroke(s, null)
  }

  function commitStroke(s: Stroke, mistake: number | null) {
    strokeRef.current = null
    setDraft(null)
    if (!playing) return
    const mistakes = mistake === null ? [] : [mistake]
    const final = resolveStroke(puzzle, cells, s.drawn, mistakes, settings.autoCross)
    if (mistake === null && final.every((c, i) => c === cells[i])) return
    const at = Date.now()
    dispatch({ type: 'commit', cells: final, mistakes, now: at })
    if (marks?.tone === 'error') setMarks(null)

    if (mistake !== null) {
      setShake({ index: mistake, key: at })
      const r = Math.floor(mistake / cols) + 1
      const c = (mistake % cols) + 1
      notify(
        puzzle.solution[mistake] === FILLED
          ? `Sai rồi! Ô hàng ${r}, cột ${c} phải được tô.`
          : `Sai rồi! Ô hàng ${r}, cột ${c} là ô trống.`,
        'error',
      )
    }

    if (isSolved(puzzle, final)) {
      winAt(at, game.hintCount, game.mistakes + mistakes.length)
      return
    }
    if (mistake !== null) sfx('error')
    else if (newlyDoneLines(puzzle, cells, final).length > 0) sfx('line')
    else if (s.erase) sfx('erase')
    else if (s.value === CROSSED) sfx('cross')
    else sfx('fill', final.filter((c) => c === FILLED).length / puzzle.filledCount)
  }

  function winAt(at: number, hints: number, mistakes: number) {
    const timeMs = elapsedAt(game, at)
    const { isRecord, previousBest } = recordWin(difficulty, timeMs)
    setWin({ timeMs, isRecord, previousBest, stars: starRating(hints, mistakes) })
    setMarks(null)
    setCursor(null)
    sfx('win')
  }

  // ------------------------------------------------------------ actions

  function undo() {
    if (!playing || game.past.length === 0) return
    dispatch({ type: 'undo' })
    setMarks(null)
    sfx('undo')
  }

  function redo() {
    if (!playing || game.future.length === 0) return
    dispatch({ type: 'redo' })
    setMarks(null)
    sfx('undo')
  }

  function clearBoard() {
    if (!playing || cells.every((c, i) => c === BLANK || flags[i] !== FREE)) return
    dispatch({ type: 'clear' })
    setMarks(null)
    sfx('erase')
    notify('Đã xóa bảng. Bấm "Hoàn tác" nếu muốn khôi phục.')
  }

  function hint() {
    if (!playing) return
    sfx('hint')
    const wrong = wrongCells(puzzle, cells)
    if (wrong.length > 0) {
      dispatch({ type: 'hint', reveal: null, now: Date.now() })
      setMarks({ cells: wrong, tone: 'error' })
      notify(
        `Có ${wrong.length} ô đánh dấu sai (viền đỏ). Hãy sửa lại trước khi đi tiếp nhé.`,
        'hint',
      )
      return
    }
    const deduction = findDeduction(puzzle, cells)
    if (!deduction) return
    const reveal = deduction.cells.find((c) => c.value === FILLED) ?? deduction.cells[0]
    const at = Date.now()
    dispatch({ type: 'hint', reveal, now: at })
    const after = cells.slice()
    after[reveal.index] = reveal.value
    if (isSolved(puzzle, after)) {
      winAt(at, game.hintCount + 1, game.mistakes)
      return
    }
    const count = deduction.cells.length
    setMarks({ cells: deduction.cells.map((c) => c.index), tone: 'hint', line: deduction })
    notify(
      `Xét ${lineName(deduction.axis, deduction.index).toLowerCase()}: từ các con số có thể suy ra ${count} ô (viền vàng). Đã ${
        reveal.value === FILLED ? 'tô' : 'đánh dấu'
      } giúp 1 ô.`,
      'hint',
    )
  }

  function togglePause() {
    if (status === 'playing') {
      endStroke()
      dispatch({ type: 'pause', now: Date.now() })
    } else if (status === 'paused') {
      dispatch({ type: 'resume', now: Date.now() })
    }
  }

  function clearRoundUi() {
    strokeRef.current = null
    setDraft(null)
    setWin(null)
    setResultOpen(false)
    setShowSolution(false)
    setMarks(null)
    setToast(null)
    setShake(null)
    setCursor(null)
  }

  function newPuzzle() {
    recordPlayed(difficulty)
    clearRoundUi()
    dispatch({
      type: 'new-puzzle',
      puzzle: generatePuzzle(difficulty),
      timeLimitMs: timeLimitMs(settings, difficulty),
      now: Date.now(),
    })
    sfx('start')
  }

  function retry() {
    recordPlayed(difficulty)
    clearRoundUi()
    dispatch({ type: 'retry', timeLimitMs: timeLimitMs(settings, difficulty), now: Date.now() })
    sfx('start')
  }

  function revealSolution() {
    setResultOpen(false)
    setMarks(null)
    setShowSolution(true)
  }

  function giveUp() {
    if (!playing && status !== 'paused') return
    endStroke()
    dispatch({ type: 'give-up', now: Date.now() })
    sfx('lose')
    revealSolution()
  }

  function openOverlay(next: Overlay) {
    if (status === 'playing') {
      endStroke()
      dispatch({ type: 'pause', now: Date.now() })
      setResumeOnClose(true)
    }
    setOverlay(next)
  }

  function closeOverlay() {
    setOverlay(null)
    if (resumeOnClose) {
      dispatch({ type: 'resume', now: Date.now() })
      setResumeOnClose(false)
    }
  }

  function leave() {
    if (!over && cells.some((c) => c !== BLANK)) openOverlay('leave')
    else onHome()
  }

  function moveCursor(dr: number, dc: number) {
    const from = cursor ?? hover
    // The keyboard takes over the highlight until the mouse moves again.
    setHover(null)
    if (from === null) {
      setCursor(0)
      return
    }
    const r = Math.min(rows - 1, Math.max(0, Math.floor(from / cols) + dr))
    const c = Math.min(cols - 1, Math.max(0, (from % cols) + dc))
    setCursor(r * cols + c)
  }

  function paintAtCursor() {
    if (!playing) return
    if (cursor === null) {
      setCursor(hover ?? 0)
      return
    }
    startStroke(cursor, false)
    endStroke()
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (overlay || resultOpen || e.altKey) return
    const target = e.target instanceof Element ? e.target : null
    if (target?.closest('input, textarea, select')) return
    const key = e.key.toLowerCase()
    const mod = e.ctrlKey || e.metaKey
    // Space or Enter on a focused button should press that button.
    if ((key === ' ' || key === 'enter') && target?.closest('button')) return
    if (key === 'y' || (key === 'z' && e.shiftKey)) redo()
    else if (key === 'z' || key === 'backspace') undo()
    else if (mod) return
    else if (key === 'arrowup' || key === 'w') moveCursor(-1, 0)
    else if (key === 'arrowdown' || key === 's') moveCursor(1, 0)
    else if (key === 'arrowleft' || key === 'a') moveCursor(0, -1)
    else if (key === 'arrowright' || key === 'd') moveCursor(0, 1)
    else if (key === ' ' || key === 'enter') paintAtCursor()
    else if (key === 'x') setTool((t) => (t === 'fill' ? 'cross' : 'fill'))
    else if (key === 'h') hint()
    else if (key === 'p') togglePause()
    else if (key === 'n') newPuzzle()
    else return
    e.preventDefault()
  })
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ------------------------------------------------------------ render

  const focus = playing ? (hover ?? cursor) : null

  let statusLine: { tone: string; text: string; action?: { label: string; run: () => void } }
  if (status === 'won') {
    statusLine = {
      tone: 'success',
      text: 'Hoàn thành! Bức tranh đã hiện ra',
      action: { label: 'Kết quả', run: () => setResultOpen(true) },
    }
  } else if (showSolution) {
    statusLine = {
      tone: 'info',
      text: 'Lời giải của câu đố',
      action: { label: 'Bảng của bạn', run: () => setShowSolution(false) },
    }
  } else if (status === 'timeout') {
    statusLine = { tone: 'danger', text: 'Hết giờ!', action: { label: 'Kết quả', run: () => setResultOpen(true) } }
  } else if (status === 'gaveup') {
    statusLine = { tone: 'neutral', text: 'Bảng của bạn', action: { label: 'Xem lời giải', run: revealSolution } }
  } else if (focus !== null) {
    statusLine = { tone: 'neutral', text: `Hàng ${Math.floor(focus / cols) + 1} · Cột ${(focus % cols) + 1}` }
  } else {
    statusLine = {
      tone: 'neutral',
      text: tool === 'fill' ? 'Chạm hoặc kéo để tô ô' : 'Chạm hoặc kéo để đánh dấu ô trống ×',
    }
  }

  return (
    <div className="game">
      <Hud
        difficulty={difficulty}
        rows={rows}
        cols={cols}
        filled={filledCount}
        filledTotal={puzzle.filledCount}
        mistakes={settings.checkMistakes || game.mistakes > 0 ? game.mistakes : null}
        elapsedMs={elapsed}
        limitMs={game.timeLimitMs}
        status={status}
        sound={settings.sound}
        onBack={leave}
        onToggleSound={() => onSettingsChange({ ...settings, sound: !settings.sound })}
        onOpenRules={() => openOverlay('rules')}
        onOpenSettings={() => openOverlay('settings')}
      />

      <main className={`board${status === 'paused' && !overlay ? ' is-paused' : ''}${over ? ' is-over' : ''}`}>
        {toast ? (
          <div
            key={toast.id}
            className={`board-status is-toast tone-${toast.tone === 'error' ? 'danger' : toast.tone}`}
            role="alert"
          >
            <Icon name={toast.tone === 'hint' ? 'hint' : toast.tone === 'error' ? 'alert' : 'help'} size={18} />
            <span>{toast.text}</span>
          </div>
        ) : (
          <div className={`board-status tone-${statusLine.tone}`} role="status">
            <span>{statusLine.text}</span>
            {statusLine.action && (
              <button type="button" onClick={statusLine.action.run}>
                {statusLine.action.label}
              </button>
            )}
          </div>
        )}

        <div className="board-canvas">
          <NonogramBoard
            key={game.round}
            puzzle={puzzle}
            cells={shownCells}
            flags={showSolution ? [] : flags}
            interactive={playing}
            highlightLines={settings.highlightLines}
            focus={focus}
            cursor={playing ? cursor : null}
            marks={marks}
            finish={status === 'won' || showSolution}
            zoom={zoom}
            shake={shake}
            onStrokeStart={(index, cross) => {
              setCursor(null)
              startStroke(index, cross)
            }}
            onStrokeMove={moveStroke}
            onStrokeEnd={endStroke}
            onHover={setHover}
          />
        </div>

        {!over && (
          <div className="toolbar" role="radiogroup" aria-label="Công cụ">
            <button
              type="button"
              role="radio"
              aria-checked={tool === 'fill'}
              className={`tool${tool === 'fill' ? ' is-active' : ''}`}
              onClick={() => setTool('fill')}
              title="Tô ô (X để đổi)"
            >
              <span className="tool-swatch" aria-hidden="true" />
              <span>Tô ô</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={tool === 'cross'}
              className={`tool${tool === 'cross' ? ' is-active' : ''}`}
              onClick={() => setTool('cross')}
              title="Đánh dấu ô trống (X để đổi, hoặc chuột phải)"
            >
              <Icon name="cross" size={18} />
              <span>Đánh dấu</span>
            </button>
            <span className="toolbar-sep" aria-hidden="true" />
            <button
              type="button"
              className="tool tool-icon"
              onClick={clearBoard}
              disabled={!playing}
              aria-label="Xóa hết"
              title="Xóa hết"
            >
              <Icon name="trash" size={18} />
            </button>
            <button
              type="button"
              className="tool tool-icon tool-zoom"
              onClick={() => setZoom((z) => !z)}
              aria-pressed={zoom}
              aria-label={zoom ? 'Thu nhỏ bảng' : 'Phóng to bảng'}
              title={zoom ? 'Thu nhỏ bảng' : 'Phóng to bảng'}
            >
              <Icon name={zoom ? 'zoomOut' : 'zoomIn'} size={18} />
            </button>
          </div>
        )}

        {status === 'paused' && !overlay && (
          <div className="pause-overlay">
            <div className="pause-card">
              <Icon name="pause" size={34} />
              <h2>Đã tạm dừng</h2>
              <p>Bảng được ẩn đi trong lúc tạm dừng.</p>
              <button type="button" className="btn btn-primary btn-lg" onClick={togglePause}>
                <Icon name="play" filled /> Tiếp tục
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="controls" aria-label="Điều khiển">
        {over ? (
          <>
            <button type="button" className="ctrl" onClick={retry}>
              <Icon name="reset" />
              <span>Chơi lại</span>
            </button>
            {status !== 'won' && (
              <button
                type="button"
                className="ctrl"
                onClick={() => (showSolution ? setShowSolution(false) : revealSolution())}
              >
                <Icon name="eye" />
                <span>{showSolution ? 'Bảng của bạn' : 'Lời giải'}</span>
              </button>
            )}
            <button type="button" className="ctrl" onClick={onHome}>
              <Icon name="home" />
              <span>Trang chủ</span>
            </button>
            <button type="button" className="ctrl is-primary" onClick={newPuzzle}>
              <Icon name="shuffle" />
              <span>Đề mới</span>
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ctrl" onClick={undo} disabled={!playing || game.past.length === 0} title="Hoàn tác (Z)">
              <Icon name="undo" />
              <span>Hoàn tác</span>
            </button>
            <button type="button" className="ctrl" onClick={redo} disabled={!playing || game.future.length === 0} title="Làm lại (Y)">
              <Icon name="redo" />
              <span>Làm lại</span>
            </button>
            <button type="button" className="ctrl is-hint" onClick={hint} disabled={!playing} title="Gợi ý (H)">
              <Icon name="hint" />
              <span>Gợi ý</span>
              {game.hintCount > 0 && <span className="ctrl-badge">{game.hintCount}</span>}
            </button>
            <button type="button" className="ctrl" onClick={togglePause} title="Tạm dừng (P)">
              <Icon name={status === 'paused' ? 'play' : 'pause'} filled={status === 'paused'} />
              <span>{status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </button>
            <button type="button" className="ctrl" onClick={giveUp} title="Bỏ cuộc và xem lời giải">
              <Icon name="flag" />
              <span>Bỏ cuộc</span>
            </button>
            <button type="button" className="ctrl is-primary" onClick={newPuzzle} title="Đề mới (N)">
              <Icon name="shuffle" />
              <span>Đề mới</span>
            </button>
          </>
        )}
      </nav>

      {resultOpen && (status === 'won' || status === 'timeout') && (
        <ResultModal
          kind={status}
          difficulty={difficulty}
          puzzle={puzzle}
          win={win}
          correctFilled={cells.filter((c, i) => c === FILLED && puzzle.solution[i] === FILLED).length}
          hintCount={game.hintCount}
          mistakes={game.mistakes}
          onNewPuzzle={newPuzzle}
          onRetry={retry}
          onShowSolution={revealSolution}
          onHome={onHome}
          onClose={() => setResultOpen(false)}
        />
      )}

      {overlay === 'settings' && (
        <SettingsModal settings={settings} onChange={onSettingsChange} onClose={closeOverlay} inGame />
      )}
      {overlay === 'rules' && <RulesModal onClose={closeOverlay} />}
      {overlay === 'leave' && (
        <Modal title="Rời khỏi ván chơi?" onClose={closeOverlay} className="confirm-modal">
          <p>Bảng hiện tại sẽ không được lưu lại.</p>
          <footer className="modal-footer">
            <button type="button" className="btn" onClick={closeOverlay}>
              Ở lại
            </button>
            <button type="button" className="btn btn-danger" onClick={onHome}>
              Rời đi
            </button>
          </footer>
        </Modal>
      )}
    </div>
  )
}
