import { useEffect, useState } from 'react'

/** Current timestamp, refreshed every `interval` ms while `active`. */
export function useNow(active: boolean, interval = 100): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [active, interval])
  return now
}
