export interface Player {
  id: string
  name: string
  jersey_number: number | null
  offense_rank: number
  defense_rank: number
  active: boolean
  created_at: string
}

export interface Game {
  id: string
  date: string
  opponent: string | null
  notes: string | null
  is_home?: boolean
  created_at: string
}

export interface GameAttendance {
  game_id: string
  player_id: string
  attending: boolean | null
}

export type Position =
  | 'P' | 'C' | '1B' | '2B' | '3B' | 'SS'
  | 'LF' | 'CF' | 'LC' | 'RC' | 'RF'
  | 'BENCH'

export const INFIELD_POSITIONS: Position[] = ['P', '1B', '2B', '3B', 'SS']
export const OUTFIELD_POSITIONS: Position[] = ['LF', 'LC', 'RC', 'RF']
export const TRADITIONAL_OUTFIELD_POSITIONS: Position[] = ['LF', 'CF', 'RF']
export const ALL_OUTFIELD_POSITIONS: Position[] = ['LF', 'CF', 'LC', 'RC', 'RF']
export const ALL_FIELD_POSITIONS: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'LC', 'RC', 'RF']

export interface InningAssignment {
  id?: string
  game_id: string
  inning: number
  player_id: string
  position: Position
}

export interface BattingOrderEntry {
  game_id: string
  player_id: string
  batting_slot: number
}
