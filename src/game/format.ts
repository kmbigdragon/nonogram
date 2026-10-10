function mmss(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Elapsed time, rounded down: 83456 → "01:23". */
export function formatClock(ms: number): string {
  return mmss(Math.floor(Math.max(0, ms) / 1000))
}

/** Remaining time, rounded up so "00:00" only shows when time is really out. */
export function formatCountdown(ms: number): string {
  return mmss(Math.ceil(Math.max(0, ms) / 1000))
}

/** Elapsed time with tenths: 83456 → "01:23.4". */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms)
  return `${formatClock(safe)}.${Math.floor((safe % 1000) / 100)}`
}

/** 90 → "1:30". */
export function formatSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
