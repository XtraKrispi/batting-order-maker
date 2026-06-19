import { useState } from 'react'
import type { Player, InningAssignment, BattingOrderEntry, Position } from '../../types'
import { INFIELD_POSITIONS, ALL_OUTFIELD_POSITIONS } from '../../types'
import { saveGameLineup, saveGameBattingOrder } from '../../lib/store'
import { generateLineup } from '../../lib/lineupGenerator'

interface Props {
  gameId: string
  players: Player[]
  attendingPlayers: Player[]
  assignments: InningAssignment[]
  battingOrder: BattingOrderEntry[]
  dirty: boolean
  attendanceStale: boolean
  absentPlayersInLineup: Player[]
  onAssignmentsChange: (assignments: InningAssignment[]) => void
  onBattingOrderChange: (battingOrder: BattingOrderEntry[]) => void
  onDirtyChange: (dirty: boolean) => void
  onLineupGenerated: () => void
  onSaved: () => void
}

const INNINGS = [1, 2, 3, 4]

function positionColor(pos: Position): string {
  if (pos === 'BENCH') return 'bg-gray-100 text-gray-400'
  if (pos === 'C') return 'bg-orange-100 text-orange-800'
  if ((INFIELD_POSITIONS as Position[]).includes(pos)) return 'bg-blue-100 text-blue-800'
  if ((ALL_OUTFIELD_POSITIONS as Position[]).includes(pos)) return 'bg-green-100 text-green-700'
  return 'bg-gray-100 text-gray-500'
}

function canReplaceFromBench(assignments: InningAssignment[], absentPlayerIds: string[]): boolean {
  const sim = [...assignments]
  for (const absentId of absentPlayerIds) {
    for (const inning of INNINGS) {
      const fieldIdx = sim.findIndex(
        (a) => a.inning === inning && a.player_id === absentId && a.position !== 'BENCH'
      )
      if (fieldIdx < 0) continue
      const benchIdx = sim.findIndex(
        (a) => a.inning === inning && a.position === 'BENCH' && !absentPlayerIds.includes(a.player_id)
      )
      if (benchIdx < 0) return false
      sim[benchIdx] = { ...sim[benchIdx], position: sim[fieldIdx].position }
    }
  }
  return true
}

export default function LineupPanel({
  gameId,
  players,
  attendingPlayers,
  assignments,
  battingOrder,
  dirty,
  attendanceStale,
  absentPlayersInLineup,
  onAssignmentsChange,
  onBattingOrderChange,
  onDirtyChange,
  onLineupGenerated,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))

  const n = attendingPlayers.length
  const availablePositions: Position[] = [
    'P', 'C', '1B', '2B', '3B', 'SS',
    ...(n === 9 ? ['LF', 'CF', 'RF'] : ['LF', 'LC', 'RC', 'RF']) as Position[],
    ...(n > 10 ? ['BENCH'] as Position[] : []),
  ]

  const hasLineup = assignments.length > 0
  const hasBattingOrder = battingOrder.length > 0
  const hasData = hasLineup || hasBattingOrder

  const handleGenerateAll = () => {
    if (attendingPlayers.length < 9) {
      setError(`Need at least 9 attending players (have ${attendingPlayers.length}).`)
      return
    }
    try {
      const { assignments: genA, battingOrder: genO } = generateLineup(attendingPlayers, gameId)
      onAssignmentsChange(genA as InningAssignment[])
      onBattingOrderChange(genO)
      onDirtyChange(true)
      onLineupGenerated()
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleGeneratePositions = () => {
    if (attendingPlayers.length < 9) {
      setError(`Need at least 9 attending players (have ${attendingPlayers.length}).`)
      return
    }
    try {
      const { assignments: genA } = generateLineup(attendingPlayers, gameId)
      onAssignmentsChange(genA as InningAssignment[])
      onDirtyChange(true)
      onLineupGenerated()
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleGenerateBattingOrder = () => {
    if (attendingPlayers.length === 0) {
      setError('No attending players.')
      return
    }
    const { battingOrder: genO } = generateLineup(attendingPlayers, gameId)
    onBattingOrderChange(genO)
    onDirtyChange(true)
    onLineupGenerated()
    setError(null)
  }

  const handleRemoveAbsentFromLineup = () => {
    const absentIds = absentPlayersInLineup.map((p) => p.id)
    let newAssignments = [...assignments]
    let newBattingOrder = [...battingOrder]

    for (const absentId of absentIds) {
      for (const inning of INNINGS) {
        const fieldIdx = newAssignments.findIndex(
          (a) => a.inning === inning && a.player_id === absentId && a.position !== 'BENCH'
        )
        if (fieldIdx < 0) continue
        const benchIdx = newAssignments.findIndex(
          (a) => a.inning === inning && a.position === 'BENCH' && !absentIds.includes(a.player_id)
        )
        if (benchIdx >= 0) {
          newAssignments[benchIdx] = { ...newAssignments[benchIdx], position: newAssignments[fieldIdx].position }
        }
      }
      newAssignments = newAssignments.filter((a) => a.player_id !== absentId)
      newBattingOrder = newBattingOrder.filter((b) => b.player_id !== absentId)
    }

    newBattingOrder = newBattingOrder
      .sort((a, b) => a.batting_slot - b.batting_slot)
      .map((b, i) => ({ ...b, batting_slot: i + 1 }))

    onAssignmentsChange(newAssignments)
    onBattingOrderChange(newBattingOrder)
    onDirtyChange(true)
    setError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveGameLineup(gameId, assignments.map(({ id: _id, ...rest }) => rest)),
        saveGameBattingOrder(gameId, battingOrder),
      ])
      onDirtyChange(false)
      onSaved()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handlePositionChange = (inning: number, playerId: string, newPos: Position) => {
    const current = assignments.find((a) => a.inning === inning && a.player_id === playerId)
    const displaced = assignments.find((a) => a.inning === inning && a.position === newPos)
    if (!current || !displaced) return
    onAssignmentsChange(
      assignments.map((a) => {
        if (a.inning === inning && a.player_id === playerId) return { ...a, position: newPos }
        if (a.inning === inning && a.player_id === displaced.player_id) return { ...a, position: current.position }
        return a
      })
    )
    onDirtyChange(true)
  }

  const moveBatting = (rowIdx: number, dir: -1 | 1) => {
    const sorted = [...battingOrder].sort((a, b) => a.batting_slot - b.batting_slot)
    const swapIdx = rowIdx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    ;[sorted[rowIdx], sorted[swapIdx]] = [sorted[swapIdx], sorted[rowIdx]]
    onBattingOrderChange(sorted.map((e, i) => ({ ...e, batting_slot: i + 1 })))
    onDirtyChange(true)
  }

  const sortedOrder = [...battingOrder].sort((a, b) => a.batting_slot - b.batting_slot)
  const orderedPlayerIds =
    sortedOrder.length > 0
      ? sortedOrder.map((e) => e.player_id)
      : attendingPlayers.map((p) => p.id)

  const ofInnings = new Map<string, number>()
  const ifInnings = new Map<string, number>()
  const benchInnings = new Map<string, number>()
  assignments.forEach((a) => {
    if ((ALL_OUTFIELD_POSITIONS as Position[]).includes(a.position)) {
      ofInnings.set(a.player_id, (ofInnings.get(a.player_id) ?? 0) + 1)
    } else if (a.position === 'BENCH') {
      benchInnings.set(a.player_id, (benchInnings.get(a.player_id) ?? 0) + 1)
    } else {
      ifInnings.set(a.player_id, (ifInnings.get(a.player_id) ?? 0) + 1)
    }
  })

  const numInnings = INNINGS.length
  const missingOF = hasLineup ? attendingPlayers.filter((p) => !ofInnings.has(p.id)) : []
  const onlyOutfield = hasLineup
    ? attendingPlayers.filter((p) => (ofInnings.get(p.id) ?? 0) === numInnings)
    : []
  const heavyOutfield = hasLineup
    ? attendingPlayers.filter((p) => (ofInnings.get(p.id) ?? 0) === numInnings - 1)
    : []
  const benchAndOutfield = hasLineup
    ? attendingPlayers.filter((p) => {
        const of = ofInnings.get(p.id) ?? 0
        const bench = benchInnings.get(p.id) ?? 0
        const infield = ifInnings.get(p.id) ?? 0
        return infield === 0 && of > 0 && bench > 0
      })
    : []

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {!hasData ? (
          <button
            onClick={handleGenerateAll}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Generate All
          </button>
        ) : (
          <>
            <button
              onClick={handleGenerateBattingOrder}
              className="bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors"
            >
              Regenerate Batting Order
            </button>
            <button
              onClick={handleGeneratePositions}
              className="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
            >
              Regenerate Positions
            </button>
          </>
        )}
        {dirty && hasData && (
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        {hasData && !dirty && (
          <span className="text-xs text-gray-400 italic">Saved</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {absentPlayersInLineup.length > 0 && hasLineup && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <strong>{absentPlayersInLineup.map((p) => p.name).join(', ')}</strong>{' '}
          {absentPlayersInLineup.length === 1 ? 'is' : 'are'} marked out but{' '}
          {absentPlayersInLineup.length === 1 ? 'still appears' : 'still appear'} in the lineup.
          <div className="flex flex-wrap gap-2 mt-2">
            {canReplaceFromBench(assignments, absentPlayersInLineup.map((p) => p.id)) && (
              <button
                onClick={handleRemoveAbsentFromLineup}
                className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Remove from lineup
              </button>
            )}
            <button
              onClick={handleGenerateAll}
              className="px-3 py-1 rounded-md bg-white border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
            >
              Regenerate lineup
            </button>
          </div>
        </div>
      )}

      {attendanceStale && absentPlayersInLineup.length === 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <strong>Attendance has changed</strong> since this lineup was generated. It may no longer be valid — consider regenerating.
        </div>
      )}

      {missingOF.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <strong>No outfield:</strong>{' '}
          {missingOF.map((p) => p.name).join(', ')}{' '}
          {missingOF.length === 1 ? 'has' : 'have'} not played outfield.
        </div>
      )}

      {onlyOutfield.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <strong>Only outfield:</strong>{' '}
          {onlyOutfield.map((p) => p.name).join(', ')}{' '}
          {onlyOutfield.length === 1 ? 'has' : 'have'} only played outfield (no infield).
        </div>
      )}

      {heavyOutfield.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <strong>Heavy outfield:</strong>{' '}
          {heavyOutfield.map((p) => p.name).join(', ')}{' '}
          {heavyOutfield.length === 1 ? 'has' : 'have'} played outfield {numInnings - 1} of {numInnings} innings.
        </div>
      )}

      {benchAndOutfield.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <strong>Bench + outfield only:</strong>{' '}
          {benchAndOutfield.map((p) => p.name).join(', ')}{' '}
          {benchAndOutfield.length === 1 ? 'has' : 'have'} only played bench and outfield (no infield).
        </div>
      )}

      {!hasData ? (
        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="font-medium">No lineup yet</p>
          <p className="text-sm mt-1">Mark attendance, then click Generate All.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right font-semibold text-gray-400 py-2 px-3 text-xs w-8">#</th>
                  <th className="text-left font-semibold text-gray-500 py-2 px-3 text-xs">Player</th>
                  {INNINGS.map((i) => (
                    <th key={i} className="text-center font-semibold text-gray-500 py-2 px-4 text-xs">
                      Inning {i}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {orderedPlayerIds.map((playerId, rowIdx) => {
                  const player = playerMap[playerId]
                  const slot = sortedOrder[rowIdx]?.batting_slot
                  return (
                    <tr key={playerId} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-300 font-bold text-right text-base">
                        {hasBattingOrder ? slot : ''}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {player?.name ?? playerId}
                        </span>
                        {player && (
                          <span className="text-xs text-gray-400 ml-2">
                            OFF {player.offense_rank}
                          </span>
                        )}
                      </td>
                      {INNINGS.map((inning) => {
                        const a = assignments.find(
                          (x) => x.inning === inning && x.player_id === playerId
                        )
                        const pos = a?.position
                        return (
                          <td key={inning} className="py-2 px-4 text-center">
                            {pos ? (
                              <div className={`inline-block rounded-md ${positionColor(pos)}`}>
                                <select
                                  value={pos}
                                  onChange={(e) =>
                                    handlePositionChange(inning, playerId, e.target.value as Position)
                                  }
                                  className="text-xs font-bold px-2 py-0.5 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 focus:rounded-md"
                                >
                                  {availablePositions.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="py-1 px-2">
                        {hasBattingOrder && (
                          <div className="flex flex-col items-center">
                            <button
                              onClick={() => moveBatting(rowIdx, -1)}
                              disabled={rowIdx === 0}
                              className="text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none text-xs"
                              title="Move up in batting order"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveBatting(rowIdx, 1)}
                              disabled={rowIdx === orderedPlayerIds.length - 1}
                              className="text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none text-xs"
                              title="Move down in batting order"
                            >
                              ▼
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
