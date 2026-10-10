export type SoundName =
  | 'start'
  | 'fill'
  | 'cross'
  | 'erase'
  | 'line'
  | 'undo'
  | 'error'
  | 'hint'
  | 'tick'
  | 'win'
  | 'lose'

/** Pentatonic scale so filling cells forms a rising melody as the picture grows. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.18) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + start
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

/** `progress` in [0, 1] picks the pitch for fill sounds. */
export function playSound(name: SoundName, progress = 0) {
  switch (name) {
    case 'start':
      tone(392, 0, 0.18, 'triangle')
      tone(523.25, 0.07, 0.22, 'triangle')
      break
    case 'fill': {
      const note = SCALE[Math.min(SCALE.length - 1, Math.floor(progress * SCALE.length))]
      tone(note, 0, 0.14, 'triangle', 0.14)
      break
    }
    case 'cross':
      tone(330, 0, 0.08, 'sine', 0.1)
      break
    case 'erase':
    case 'undo':
      tone(440, 0, 0.1, 'sine', 0.12)
      tone(349.23, 0.06, 0.12, 'sine', 0.12)
      break
    case 'line':
      tone(1046.5, 0, 0.12, 'sine', 0.09)
      tone(1567.98, 0.06, 0.18, 'sine', 0.09)
      break
    case 'error':
      tone(180, 0, 0.16, 'square', 0.06)
      tone(150, 0.1, 0.2, 'square', 0.05)
      break
    case 'hint':
      tone(880, 0, 0.12, 'sine', 0.1)
      tone(1318.51, 0.08, 0.2, 'sine', 0.1)
      break
    case 'tick':
      tone(1000, 0, 0.05, 'square', 0.04)
      break
    case 'win':
      ;[523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle', 0.16))
      break
    case 'lose':
      ;[392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, i * 0.14, 0.3, 'triangle', 0.14))
      break
  }
}
