import { DIFFICULTIES, isDifficultyId, type DifficultyId } from './difficulty.ts'

export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Settings {
  timeLimitEnabled: boolean
  /** Seconds per difficulty. */
  timeLimits: Record<DifficultyId, number>
  /** Cross out the rest of a row or column once its clue is satisfied. */
  autoCross: boolean
  /** Tint the row and column under the pointer. */
  highlightLines: boolean
  /** Reveal wrong moves at once and count them as mistakes. */
  checkMistakes: boolean
  sound: boolean
  theme: ThemeMode
}

export interface LevelRecord {
  bestMs: number | null
  wins: number
  played: number
}

export type Records = Record<DifficultyId, LevelRecord>

export const TIME_LIMIT_MIN = 30
export const TIME_LIMIT_MAX = 90 * 60

const SETTINGS_KEY = 'nonogram:settings'
const RECORDS_KEY = 'nonogram:records'
const DIFFICULTY_KEY = 'nonogram:difficulty'

export function defaultTimeLimits(): Record<DifficultyId, number> {
  return Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.defaultTime])) as Record<DifficultyId, number>
}

export const DEFAULT_SETTINGS: Settings = {
  timeLimitEnabled: true,
  timeLimits: defaultTimeLimits(),
  autoCross: true,
  highlightLines: true,
  checkMistakes: false,
  sound: true,
  theme: 'auto',
}

function read<T>(key: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Partial<T>) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable (private mode); the game still works without it.
  }
}

export function loadSettings(): Settings {
  const saved = read<Settings>(SETTINGS_KEY)
  if (!saved) return DEFAULT_SETTINGS
  const timeLimits = { ...DEFAULT_SETTINGS.timeLimits }
  for (const d of DIFFICULTIES) {
    const value = saved.timeLimits?.[d.id]
    if (typeof value === 'number' && value >= TIME_LIMIT_MIN && value <= TIME_LIMIT_MAX) timeLimits[d.id] = value
  }
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  return {
    timeLimitEnabled: bool(saved.timeLimitEnabled, DEFAULT_SETTINGS.timeLimitEnabled),
    timeLimits,
    autoCross: bool(saved.autoCross, DEFAULT_SETTINGS.autoCross),
    highlightLines: bool(saved.highlightLines, DEFAULT_SETTINGS.highlightLines),
    checkMistakes: bool(saved.checkMistakes, DEFAULT_SETTINGS.checkMistakes),
    sound: bool(saved.sound, DEFAULT_SETTINGS.sound),
    theme: saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : 'auto',
  }
}

export function saveSettings(settings: Settings) {
  write(SETTINGS_KEY, settings)
}

export function timeLimitMs(settings: Settings, difficulty: DifficultyId): number | null {
  return settings.timeLimitEnabled ? settings.timeLimits[difficulty] * 1000 : null
}

export function loadRecords(): Records {
  const saved = read<Records>(RECORDS_KEY) ?? {}
  const records = {} as Records
  for (const d of DIFFICULTIES) {
    const r = saved[d.id]
    records[d.id] = {
      bestMs: typeof r?.bestMs === 'number' ? r.bestMs : null,
      wins: typeof r?.wins === 'number' ? r.wins : 0,
      played: typeof r?.played === 'number' ? r.played : 0,
    }
  }
  return records
}

export function recordPlayed(difficulty: DifficultyId) {
  const records = loadRecords()
  records[difficulty].played++
  write(RECORDS_KEY, records)
}

/** Stores a win and reports the previous best time. */
export function recordWin(difficulty: DifficultyId, timeMs: number): { previousBest: number | null; isRecord: boolean } {
  const records = loadRecords()
  const level = records[difficulty]
  const previousBest = level.bestMs
  const isRecord = previousBest === null || timeMs < previousBest
  level.wins++
  if (isRecord) level.bestMs = timeMs
  write(RECORDS_KEY, records)
  return { previousBest, isRecord }
}

export function loadLastDifficulty(): DifficultyId {
  try {
    const value = localStorage.getItem(DIFFICULTY_KEY)
    return isDifficultyId(value) ? value : 'easy'
  } catch {
    return 'easy'
  }
}

export function saveLastDifficulty(difficulty: DifficultyId) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, difficulty)
  } catch {
    // ignore
  }
}
