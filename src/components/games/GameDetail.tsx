import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Player, Game, GameAttendance, InningAssignment, BattingOrderEntry } from '../../types'
import {
  getGame,
  getPlayers,
  getGameAttendance,
  getGameLineup,
  getGameBattingOrder,
  exportGame,
} from '../../lib/store'
import { downloadJSON } from '../../lib/fileIO'
import AttendancePanel from './AttendancePanel'
import LineupPanel from './LineupPanel'

type Tab = 'attendance' | 'lineup'

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function GameDetail() {
  const { id } = useParams<{ id: string }>()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [attendance, setAttendance] = useState<GameAttendance[]>([])
  const [workingAssignments, setWorkingAssignments] = useState<InningAssignment[]>([])
  const [workingBattingOrder, setWorkingBattingOrder] = useState<BattingOrderEntry[]>([])
  const [lineupDirty, setLineupDirty] = useState(false)
  const [lineupSnapshotIds, setLineupSnapshotIds] = useState<ReadonlySet<string>>(new Set())
  const [tab, setTab] = useState<Tab>('attendance')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const [g, ps, att, lineup, batting] = await Promise.all([
        getGame(id),
        getPlayers(),
        getGameAttendance(id),
        getGameLineup(id),
        getGameBattingOrder(id),
      ])
      setGame(g)
      setPlayers(ps.filter((p) => p.active))
      setAttendance(att)
      setWorkingAssignments(lineup)
      setWorkingBattingOrder(batting)
      setLineupDirty(false)
      setLineupSnapshotIds(new Set([
        ...lineup.map((a) => a.player_id),
        ...batting.map((b) => b.player_id),
      ]))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void loadAll() }, [loadAll])

  const reloadAttendance = async () => {
    if (!id) return
    const att = await getGameAttendance(id)
    setAttendance(att)
  }

  const attendingPlayers = players.filter((p) => {
    const rec = attendance.find((a) => a.player_id === p.id)
    return rec?.attending !== false
  })

  const hasLineupData = workingAssignments.length > 0 || workingBattingOrder.length > 0
  const currentAttendingIds = new Set(attendingPlayers.map((p) => p.id))
  const lineupIsStale =
    hasLineupData &&
    lineupSnapshotIds.size > 0 &&
    ([...lineupSnapshotIds].some((pid) => !currentAttendingIds.has(pid)) ||
      [...currentAttendingIds].some((pid) => !lineupSnapshotIds.has(pid)))

  const handleLineupGenerated = useCallback(() => {
    setLineupSnapshotIds(new Set(attendingPlayers.map((p) => p.id)))
  }, [attendingPlayers])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'attendance', label: `Attendance (${attendingPlayers.length})` },
    { key: 'lineup', label: `Lineup${hasLineupData ? ' ✓' : ''}` },
  ]

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading…</div>
  }

  if (error || !game) {
    return (
      <div className="text-center py-12 text-red-500">
        {error ?? 'Game not found'}
      </div>
    )
  }

  const handleExport = () => {
    const data = exportGame(game.id)
    const datePart = game.date.replace(/-/g, '')
    const opponentPart = game.opponent ? `-${game.opponent.replace(/\s+/g, '_')}` : ''
    downloadJSON(data, `game-${datePart}${opponentPart}.json`)
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          ← All Games
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatDate(game.date)}
            </h1>
            {game.opponent && (
              <p className="text-gray-500 mt-0.5">vs. {game.opponent}</p>
            )}
            {game.notes && (
              <p className="text-sm text-gray-400 italic mt-0.5">{game.notes}</p>
            )}
          </div>
          <button
            onClick={handleExport}
            className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors shrink-0 ml-4"
          >
            Export Game
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'attendance' && (
        <AttendancePanel
          gameId={game.id}
          players={players}
          attendance={attendance}
          onChange={() => void reloadAttendance()}
        />
      )}

      {tab === 'lineup' && (
        <LineupPanel
          gameId={game.id}
          players={players}
          attendingPlayers={attendingPlayers}
          assignments={workingAssignments}
          battingOrder={workingBattingOrder}
          dirty={lineupDirty}
          attendanceStale={lineupIsStale}
          onAssignmentsChange={setWorkingAssignments}
          onBattingOrderChange={setWorkingBattingOrder}
          onDirtyChange={setLineupDirty}
          onLineupGenerated={handleLineupGenerated}
          onSaved={() => void loadAll()}
        />
      )}
    </div>
  )
}
