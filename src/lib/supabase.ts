import { createClient } from '@supabase/supabase-js'
import type {
  Player,
  Game,
  GameAttendance,
  InningAssignment,
  BattingOrderEntry,
} from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Players
export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name')
  if (error) throw error
  return data as Player[]
}

export async function upsertPlayer(
  player: Omit<Player, 'id' | 'created_at'> & { id?: string }
): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .upsert(player)
    .select()
    .single()
  if (error) throw error
  return data as Player
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

// Games
export async function getGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data as Game[]
}

export async function getGame(id: string): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Game
}

export async function createGame(
  game: Omit<Game, 'id' | 'created_at'>
): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .insert(game)
    .select()
    .single()
  if (error) throw error
  return data as Game
}

export async function updateGame(
  id: string,
  game: Partial<Omit<Game, 'id' | 'created_at'>>
): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .update(game)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Game
}

export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from('games').delete().eq('id', id)
  if (error) throw error
}

// Attendance
export async function getGameAttendance(gameId: string): Promise<GameAttendance[]> {
  const { data, error } = await supabase
    .from('game_attendance')
    .select('*')
    .eq('game_id', gameId)
  if (error) throw error
  return data as GameAttendance[]
}

export async function setPlayerAttendance(
  gameId: string,
  playerId: string,
  attending: boolean | null
): Promise<void> {
  const { error } = await supabase
    .from('game_attendance')
    .upsert({ game_id: gameId, player_id: playerId, attending })
  if (error) throw error
}

// Lineup
export async function getGameLineup(gameId: string): Promise<InningAssignment[]> {
  const { data, error } = await supabase
    .from('game_inning_assignments')
    .select('*')
    .eq('game_id', gameId)
    .order('inning')
  if (error) throw error
  return data as InningAssignment[]
}

export async function saveGameLineup(
  gameId: string,
  assignments: Omit<InningAssignment, 'id'>[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('game_inning_assignments')
    .delete()
    .eq('game_id', gameId)
  if (delError) throw delError

  if (assignments.length === 0) return

  const { error } = await supabase
    .from('game_inning_assignments')
    .insert(assignments)
  if (error) throw error
}

// Batting order
export async function getGameBattingOrder(gameId: string): Promise<BattingOrderEntry[]> {
  const { data, error } = await supabase
    .from('game_batting_order')
    .select('*')
    .eq('game_id', gameId)
    .order('batting_slot')
  if (error) throw error
  return data as BattingOrderEntry[]
}

export async function saveGameBattingOrder(
  gameId: string,
  entries: Omit<BattingOrderEntry, never>[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('game_batting_order')
    .delete()
    .eq('game_id', gameId)
  if (delError) throw delError

  if (entries.length === 0) return

  const { error } = await supabase.from('game_batting_order').insert(entries)
  if (error) throw error
}
