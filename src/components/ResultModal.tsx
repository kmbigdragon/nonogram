import { getDifficulty, type DifficultyId } from '../game/difficulty.ts'
import { formatDuration } from '../game/format.ts'
import { FILLED, type Puzzle } from '../game/puzzle.ts'
import { Confetti } from './Confetti.tsx'
import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'

export interface WinInfo {
  timeMs: number
  stars: number
  isRecord: boolean
  previousBest: number | null
}

interface ResultModalProps {
  kind: 'won' | 'timeout'
  difficulty: DifficultyId
  puzzle: Puzzle
  win: WinInfo | null
  correctFilled: number
  hintCount: number
  mistakes: number
  onNewPuzzle: () => void
  onRetry: () => void
  onShowSolution: () => void
  onHome: () => void
  onClose: () => void
}

const WIN_TITLES = ['Hoàn thành!', 'Hoàn thành!', 'Tuyệt vời!', 'Xuất sắc!']

/** The solved picture as a small pixel-art thumbnail. */
function Picture({ puzzle }: { puzzle: Puzzle }) {
  const { rows, cols } = puzzle
  const span = Math.max(1, rows + cols - 2)
  return (
    <svg className="result-picture" viewBox={`-0.5 -0.5 ${cols + 1} ${rows + 1}`} aria-hidden="true">
      {puzzle.solution.map((v, i) => {
        if (v !== FILLED) return null
        const r = Math.floor(i / cols)
        const c = i % cols
        return (
          <rect
            key={i}
            x={c + 0.04}
            y={r + 0.04}
            width={0.92}
            height={0.92}
            rx={0.18}
            fill={`hsl(${258 + (77 * (r + c)) / span} 82% 62%)`}
          />
        )
      })}
    </svg>
  )
}

export function ResultModal({
  kind,
  difficulty,
  puzzle,
  win,
  correctFilled,
  hintCount,
  mistakes,
  onNewPuzzle,
  onRetry,
  onShowSolution,
  onHome,
  onClose,
}: ResultModalProps) {
  const level = getDifficulty(difficulty)

  if (kind === 'won' && win) {
    return (
      <>
        <Confetti />
        <Modal onClose={onClose} className="result-modal is-won">
          <div className="result-hero">
            <div className="result-art">
              <Picture puzzle={puzzle} />
            </div>
            <h2>{WIN_TITLES[win.stars]}</h2>
            <p>
              Bạn đã giải xong câu đố {puzzle.rows}×{puzzle.cols}.
            </p>
            <div className="stars" aria-label={`${win.stars} trên 3 sao`}>
              {[1, 2, 3].map((i) => (
                <span key={i} className={i <= win.stars ? 'star is-on' : 'star'} style={{ animationDelay: `${0.25 + i * 0.15}s` }}>
                  <Icon name="star" size={34} filled />
                </span>
              ))}
            </div>
          </div>

          <div className="result-stats">
            <div>
              <span className="result-stat-value">{formatDuration(win.timeMs)}</span>
              <span className="result-stat-label">Thời gian</span>
            </div>
            <div>
              <span className="result-stat-value">{mistakes}</span>
              <span className="result-stat-label">Lỗi</span>
            </div>
            <div>
              <span className="result-stat-value">{hintCount}</span>
              <span className="result-stat-label">Gợi ý</span>
            </div>
          </div>

          <div className={win.isRecord ? 'result-record is-new' : 'result-record'}>
            <Icon name="trophy" size={18} />
            {win.isRecord ? (
              <span>
                Kỷ lục mới ở mức <strong>{level.label}</strong>
                {win.previousBest !== null && <> (trước đó {formatDuration(win.previousBest)})</>}!
              </span>
            ) : (
              <span>
                Kỷ lục mức {level.label}: <strong>{formatDuration(win.previousBest ?? win.timeMs)}</strong>
              </span>
            )}
          </div>

          <div className="result-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onNewPuzzle}>
              <Icon name="shuffle" /> Đề mới
            </button>
            <div className="result-actions-row">
              <button type="button" className="btn" onClick={onRetry}>
                <Icon name="reset" /> Chơi lại đề này
              </button>
              <button type="button" className="btn" onClick={onClose}>
                <Icon name="eye" /> Ngắm bức tranh
              </button>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onHome}>
              <Icon name="home" /> Về trang chủ
            </button>
          </div>
        </Modal>
      </>
    )
  }

  return (
    <Modal onClose={onClose} className="result-modal is-timeout">
      <div className="result-hero">
        <div className="result-badge">
          <Icon name="clock" size={40} />
        </div>
        <h2>Hết giờ!</h2>
        <p>
          Bạn đã tô đúng <strong>{correctFilled}</strong>/{puzzle.filledCount} ô. Đừng nản — thử lại nhé!
        </p>
      </div>
      <div className="result-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onShowSolution}>
          <Icon name="eye" /> Xem lời giải
        </button>
        <div className="result-actions-row">
          <button type="button" className="btn" onClick={onRetry}>
            <Icon name="reset" /> Thử lại đề này
          </button>
          <button type="button" className="btn" onClick={onNewPuzzle}>
            <Icon name="shuffle" /> Đề mới
          </button>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          <Icon name="home" /> Về trang chủ
        </button>
      </div>
    </Modal>
  )
}
