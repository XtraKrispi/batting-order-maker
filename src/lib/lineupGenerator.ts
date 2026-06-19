import type { Player, Position, InningAssignment, BattingOrderEntry } from '../types'
import { INFIELD_POSITIONS, OUTFIELD_POSITIONS, TRADITIONAL_OUTFIELD_POSITIONS } from '../types'

export interface GeneratedLineup {
  assignments: Omit<InningAssignment, 'id'>[]
  battingOrder: BattingOrderEntry[]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// Distribute bench slots across 4 innings, avoiding consecutive benching.
// For 10-12 players benching is ≤2/inning so each player sits at most once.
function createBenchSchedule(
  players: Player[],
  benchPerInning: number
): Map<number, Set<string>> {
  const schedule = new Map<number, Set<string>>([
    [1, new Set()],
    [2, new Set()],
    [3, new Set()],
    [4, new Set()],
  ])

  if (benchPerInning === 0) return schedule

  // Shuffle and assign: first benchPerInning go to inning 1, next to inning 2, etc.
  // Each player sits at most once, so no consecutive bench issue.
  const shuffled = shuffle(players)
  let idx = 0
  for (let inning = 1; inning <= 4; inning++) {
    for (let b = 0; b < benchPerInning; b++) {
      if (idx < shuffled.length) {
        schedule.get(inning)!.add(shuffled[idx].id)
        idx++
      }
    }
  }

  return schedule
}

// Assign players to positions with no repeats via backtracking (most-constrained first).
// Falls back to greedy best-effort if no perfect assignment exists.
function assignNoRepeat(
  players: Player[],
  positions: Position[],
  playedPositions: Map<string, Set<Position>>
): Map<string, Position> {
  // Sort most-constrained first to improve backtracking efficiency
  const sorted = [...players].sort((a, b) => {
    const aAvail = positions.filter((p) => !playedPositions.get(a.id)?.has(p)).length
    const bAvail = positions.filter((p) => !playedPositions.get(b.id)?.has(p)).length
    return aAvail - bAvail
  })

  const assignment = new Map<string, Position>()
  const usedPositions = new Set<Position>()

  function backtrack(idx: number): boolean {
    if (idx === sorted.length) return true
    const player = sorted[idx]
    const played = playedPositions.get(player.id) ?? new Set<Position>()
    const candidates = shuffle(positions.filter((p) => !usedPositions.has(p) && !played.has(p)))

    for (const pos of candidates) {
      assignment.set(player.id, pos)
      usedPositions.add(pos)
      if (backtrack(idx + 1)) return true
      assignment.delete(player.id)
      usedPositions.delete(pos)
    }

    return false
  }

  if (!backtrack(0)) {
    // Fallback: greedy assignment minimizing repeats
    assignment.clear()
    const remaining = new Set(positions)
    for (const player of sorted) {
      const played = playedPositions.get(player.id) ?? new Set<Position>()
      const preferred = [...remaining].find((p) => !played.has(p))
      const pos = preferred ?? remaining.values().next().value!
      assignment.set(player.id, pos)
      remaining.delete(pos)
    }
  }

  return assignment
}

function assignInningPositions(
  active: Player[],
  inning: number,
  hasPlayedOutfield: Set<string>,
  lastInningOF: Set<string>,
  forcedToOFIds: string[],
  playedPositions: Map<string, Set<Position>>,
  outfieldPositions: Position[]
): Omit<InningAssignment, 'id'>[] {
  const isStrongInning = inning === 1 || inning === 4
  const ofCount = outfieldPositions.length

  // Score for outfield suitability (higher = goes to OF)
  const ofScores = active.map((p) => {
    let s = (10 - p.defense_rank) * 10
    if (!hasPlayedOutfield.has(p.id)) s += 25
    if (lastInningOF.has(p.id)) s -= 20
    if (forcedToOFIds.includes(p.id)) s += 1000
    if (!isStrongInning) s += (Math.random() - 0.5) * 8
    return { p, s }
  })

  ofScores.sort((a, b) => b.s - a.s)

  const ofPlayers = ofScores.slice(0, ofCount).map((x) => x.p)
  const remaining = ofScores.slice(ofCount).map((x) => x.p)

  // Score for catcher suitability; strongly penalize repeat catchers
  const cScores = remaining.map((p) => {
    let s = (10 - p.defense_rank) * 5
    if (playedPositions.get(p.id)?.has('C')) s -= 1000
    if (!isStrongInning) s += (Math.random() - 0.5) * 4
    return { p, s }
  })
  cScores.sort((a, b) => b.s - a.s)

  const catcher = cScores[0].p
  const infieldPlayers = cScores.slice(1).map((x) => x.p)

  const result: Omit<InningAssignment, 'id'>[] = []
  const gameId = '' // filled in by caller

  const ofAssignment = assignNoRepeat(ofPlayers, [...outfieldPositions], playedPositions)
  ofPlayers.forEach((p) =>
    result.push({ game_id: gameId, inning, player_id: p.id, position: ofAssignment.get(p.id)! })
  )

  result.push({ game_id: gameId, inning, player_id: catcher.id, position: 'C' })

  const ifAssignment = assignNoRepeat(infieldPlayers, [...INFIELD_POSITIONS], playedPositions)
  infieldPlayers.forEach((p) =>
    result.push({ game_id: gameId, inning, player_id: p.id, position: ifAssignment.get(p.id)! })
  )

  return result
}

function generateBattingOrder(
  players: Player[],
  gameId: string
): BattingOrderEntry[] {
  const remaining = [...players]
  const order: BattingOrderEntry[] = []
  let slot = 1

  while (remaining.length > 0) {
    // Higher offense rank = more likely to bat earlier; weight = rank^1.5
    const weights = remaining.map((p) => Math.pow(p.offense_rank, 1.5))
    const picked = weightedPick(remaining, weights)
    order.push({ game_id: gameId, player_id: picked.id, batting_slot: slot })
    remaining.splice(remaining.indexOf(picked), 1)
    slot++
  }

  return order
}

export function generateLineup(
  players: Player[],
  gameId: string
): GeneratedLineup {
  if (players.length < 9) {
    throw new Error(`Need at least 9 attending players, got ${players.length}`)
  }

  const outfieldPositions = players.length === 9 ? TRADITIONAL_OUTFIELD_POSITIONS : OUTFIELD_POSITIONS
  const fieldPositionCount = 6 + outfieldPositions.length  // SS/P/C/1B/2B/3B + OF
  const benchPerInning = Math.max(0, players.length - fieldPositionCount)
  const benchSchedule = createBenchSchedule(players, benchPerInning)

  const allAssignments: Omit<InningAssignment, 'id'>[] = []
  const hasPlayedOutfield = new Set<string>()
  let lastInningOF = new Set<string>()
  const playedPositions = new Map<string, Set<Position>>()

  for (let inning = 1; inning <= 4; inning++) {
    const benchedIds = benchSchedule.get(inning)!
    const active = players.filter((p) => !benchedIds.has(p.id))

    // Inning 4: any active player who still hasn't played OF must go to OF
    const forcedToOFIds =
      inning === 4
        ? active.filter((p) => !hasPlayedOutfield.has(p.id)).map((p) => p.id)
        : []

    const inningAssignments = assignInningPositions(
      active,
      inning,
      hasPlayedOutfield,
      lastInningOF,
      forcedToOFIds,
      playedPositions,
      outfieldPositions
    )

    // Fix game_id (was set to '' placeholder above)
    const withGameId = inningAssignments.map((a) => ({ ...a, game_id: gameId }))
    allAssignments.push(...withGameId)

    // Bench assignments
    benchedIds.forEach((pid) =>
      allAssignments.push({ game_id: gameId, inning, player_id: pid, position: 'BENCH' })
    )

    // Update outfield history for next inning
    const thisOF = new Set(
      withGameId
        .filter((a) => (outfieldPositions as Position[]).includes(a.position))
        .map((a) => a.player_id)
    )
    thisOF.forEach((id) => hasPlayedOutfield.add(id))
    lastInningOF = thisOF

    // Update played positions tracker for subsequent innings
    withGameId.forEach((a) => {
      if (!playedPositions.has(a.player_id)) playedPositions.set(a.player_id, new Set())
      playedPositions.get(a.player_id)!.add(a.position)
    })
  }

  const battingOrder = generateBattingOrder(players, gameId)

  return { assignments: allAssignments, battingOrder }
}
