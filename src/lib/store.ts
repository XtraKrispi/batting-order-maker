import type {
  Player,
  Game,
  GameAttendance,
  InningAssignment,
  BattingOrderEntry,
} from '../types'

const STORAGE_KEY = 'batting-order-maker'

interface PersistedState {
  players: Player[]
  games: Game[]
  attendance: GameAttendance[]
  assignments: InningAssignment[]
  battingOrders: BattingOrderEntry[]
}

function loadFromStorage(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      return {
        players: parsed.players ?? [],
        games: parsed.games ?? [],
        attendance: parsed.attendance ?? [],
        assignments: parsed.assignments ?? [],
        battingOrders: parsed.battingOrders ?? [],
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return { players: [], games: [], attendance: [], assignments: [], battingOrders: [] }
}

function persist(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ players: _players, games: _games, attendance: _attendance, assignments: _assignments, battingOrders: _battingOrders })
  )
}

const _initial = loadFromStorage()
let _players: Player[] = _initial.players
let _games: Game[] = _initial.games
let _attendance: GameAttendance[] = _initial.attendance
let _assignments: InningAssignment[] = _initial.assignments
let _battingOrders: BattingOrderEntry[] = _initial.battingOrders

// Players

export async function getPlayers(): Promise<Player[]> {
  return [..._players].sort((a, b) => a.name.localeCompare(b.name))
}

export async function upsertPlayer(
  player: Omit<Player, 'id' | 'created_at'> & { id?: string }
): Promise<Player> {
  if (player.id) {
    const idx = _players.findIndex((p) => p.id === player.id)
    if (idx >= 0) {
      _players[idx] = { ..._players[idx], ...player } as Player
      persist()
      return _players[idx]
    }
  }
  const newPlayer: Player = {
    ...player,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  }
  _players.push(newPlayer)
  persist()
  return newPlayer
}

export async function deletePlayer(id: string): Promise<void> {
  _players = _players.filter((p) => p.id !== id)
  _attendance = _attendance.filter((a) => a.player_id !== id)
  _assignments = _assignments.filter((a) => a.player_id !== id)
  _battingOrders = _battingOrders.filter((b) => b.player_id !== id)
  persist()
}

// Games

export async function getGames(): Promise<Game[]> {
  return [..._games].sort((a, b) => b.date.localeCompare(a.date))
}

export async function getGame(id: string): Promise<Game> {
  const game = _games.find((g) => g.id === id)
  if (!game) throw new Error('Game not found')
  return game
}

export async function createGame(
  game: Omit<Game, 'id' | 'created_at'>
): Promise<Game> {
  const newGame: Game = {
    ...game,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  }
  _games.push(newGame)
  persist()
  return newGame
}

export async function updateGame(
  id: string,
  game: Partial<Omit<Game, 'id' | 'created_at'>>
): Promise<Game> {
  const idx = _games.findIndex((g) => g.id === id)
  if (idx < 0) throw new Error('Game not found')
  _games[idx] = { ..._games[idx], ...game }
  persist()
  return _games[idx]
}

export async function deleteGame(id: string): Promise<void> {
  _games = _games.filter((g) => g.id !== id)
  _attendance = _attendance.filter((a) => a.game_id !== id)
  _assignments = _assignments.filter((a) => a.game_id !== id)
  _battingOrders = _battingOrders.filter((b) => b.game_id !== id)
  persist()
}

// Attendance

export async function getGameAttendance(gameId: string): Promise<GameAttendance[]> {
  return _attendance.filter((a) => a.game_id === gameId)
}

export async function setPlayerAttendance(
  gameId: string,
  playerId: string,
  attending: boolean | null
): Promise<void> {
  const idx = _attendance.findIndex(
    (a) => a.game_id === gameId && a.player_id === playerId
  )
  if (idx >= 0) {
    _attendance[idx] = { game_id: gameId, player_id: playerId, attending }
  } else {
    _attendance.push({ game_id: gameId, player_id: playerId, attending })
  }
  persist()
}

// Lineup

export async function getGameLineup(gameId: string): Promise<InningAssignment[]> {
  return _assignments
    .filter((a) => a.game_id === gameId)
    .sort((a, b) => a.inning - b.inning)
}

export async function saveGameLineup(
  gameId: string,
  assignments: Omit<InningAssignment, 'id'>[]
): Promise<void> {
  _assignments = _assignments.filter((a) => a.game_id !== gameId)
  _assignments.push(...assignments.map((a) => ({ ...a, id: crypto.randomUUID() })))
  persist()
}

// Batting order

export async function getGameBattingOrder(gameId: string): Promise<BattingOrderEntry[]> {
  return _battingOrders
    .filter((b) => b.game_id === gameId)
    .sort((a, b) => a.batting_slot - b.batting_slot)
}

export async function saveGameBattingOrder(
  gameId: string,
  entries: BattingOrderEntry[]
): Promise<void> {
  _battingOrders = _battingOrders.filter((b) => b.game_id !== gameId)
  _battingOrders.push(...entries)
  persist()
}

// Bulk load (used by file import)

export function loadRoster(players: Player[]): void {
  _players = players
  persist()
}

export interface GameExport {
  version: 1
  game: Game
  players: Player[]
  attendance: GameAttendance[]
  assignments: InningAssignment[]
  battingOrder: BattingOrderEntry[]
}

export function exportGame(gameId: string): GameExport {
  const game = _games.find((g) => g.id === gameId)
  if (!game) throw new Error('Game not found')
  const attendance = _attendance.filter((a) => a.game_id === gameId)
  const assignments = _assignments.filter((a) => a.game_id === gameId)
  const battingOrder = _battingOrders.filter((b) => b.game_id === gameId)
  const referencedIds = new Set([
    ...attendance.map((a) => a.player_id),
    ...assignments.map((a) => a.player_id),
    ...battingOrder.map((b) => b.player_id),
  ])
  const players = _players.filter((p) => referencedIds.has(p.id))
  return { version: 1, game, players, attendance, assignments, battingOrder }
}

export function importGame(data: GameExport): void {
  // Merge any players from the file that aren't in the store
  for (const p of data.players) {
    if (!_players.find((existing) => existing.id === p.id)) {
      _players.push(p)
    }
  }
  // Replace game
  _games = _games.filter((g) => g.id !== data.game.id)
  _games.push(data.game)
  // Replace game data
  _attendance = _attendance.filter((a) => a.game_id !== data.game.id)
  _attendance.push(...data.attendance)
  _assignments = _assignments.filter((a) => a.game_id !== data.game.id)
  _assignments.push(...data.assignments)
  _battingOrders = _battingOrders.filter((b) => b.game_id !== data.game.id)
  _battingOrders.push(...data.battingOrder)
  persist()
}
