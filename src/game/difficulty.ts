export type DifficultyId = 'easy' | 'medium' | 'hard' | 'expert'

export interface Difficulty {
  id: DifficultyId
  label: string
  /** 1–4, used for the signal-bar badge. */
  level: number
  rows: number
  cols: number
  /** Chance that a cell of the random picture is filled. */
  density: number
  /** Chance that the picture is mirrored left–right, which reads more like a drawing. */
  symmetry: number
  /** Default time limit in seconds. */
  defaultTime: number
  description: string
}

export const DIFFICULTIES: Difficulty[] = [
  {
    id: 'easy',
    label: 'Dễ',
    level: 1,
    rows: 5,
    cols: 5,
    density: 0.62,
    symmetry: 0.5,
    defaultTime: 180,
    description: 'Làm quen với luật chơi',
  },
  {
    id: 'medium',
    label: 'Trung bình',
    level: 2,
    rows: 10,
    cols: 10,
    density: 0.58,
    symmetry: 0.5,
    defaultTime: 600,
    description: 'Bắt đầu phải suy luận',
  },
  {
    id: 'hard',
    label: 'Khó',
    level: 3,
    rows: 15,
    cols: 15,
    density: 0.55,
    symmetry: 0.35,
    defaultTime: 1200,
    description: 'Nhiều dòng phải kết hợp',
  },
  {
    id: 'expert',
    label: 'Rất khó',
    level: 4,
    rows: 20,
    cols: 20,
    density: 0.53,
    symmetry: 0.25,
    defaultTime: 2400,
    description: 'Thử thách thực sự',
  },
]

export function getDifficulty(id: DifficultyId): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0]
}

export function isDifficultyId(value: unknown): value is DifficultyId {
  return DIFFICULTIES.some((d) => d.id === value)
}
