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
  updateGame,
} from '../../lib/store'
import { downloadJSON, printLineup } from '../../lib/fileIO'
import AttendancePanel from './AttendancePanel'
import LineupPanel from './LineupPanel'

type Tab = 'attendance' | 'lineup'

interface EditGameFormProps {
  game: Game
  onSave: (game: Game) => void
  onCancel: () => void
}

function EditGameForm({ game, onSave, onCancel }: EditGameFormProps) {
  const [form, setForm] = useState({
    date: game.date,
    opponent: game.opponent ?? '',
    notes: game.notes ?? '',
    is_home: game.is_home !== false,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const updated = await updateGame(game.id, {
      date: form.date,
      opponent: form.opponent.trim() || null,
      notes: form.notes.trim() || null,
      is_home: form.is_home,
    })
    setSaving(false)
    onSave(updated)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Game</h2>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opponent
            </label>
            <input
              type="text"
              value={form.opponent}
              onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Team name (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Home / Away
            </label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden w-fit text-sm">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_home: true }))}
                className={`px-4 py-1.5 font-medium transition-colors ${form.is_home ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_home: false }))}
                className={`px-4 py-1.5 font-medium transition-colors border-l border-gray-300 ${!form.is_home ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Away
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
  const [showEdit, setShowEdit] = useState(false)
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

  const lineupPlayerIds = new Set([
    ...workingAssignments.map((a) => a.player_id),
    ...workingBattingOrder.map((b) => b.player_id),
  ])
  const absentPlayersInLineup = players.filter((p) => {
    const isAbsent = attendance.find((a) => a.player_id === p.id)?.attending === false
    return isAbsent && lineupPlayerIds.has(p.id)
  })

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

  const handlePrint = () => {
    printLineup(game, players, workingAssignments, workingBattingOrder)
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
              <p className="text-gray-500 mt-0.5">
                {game.is_home === false ? '@' : 'vs.'} {game.opponent}
              </p>
            )}
            {game.is_home !== undefined && !game.opponent && (
              <p className="text-sm text-gray-400 mt-0.5">
                {game.is_home === false ? 'Away game' : 'Home game'}
              </p>
            )}
            {game.notes && (
              <p className="text-sm text-gray-400 italic mt-0.5">{game.notes}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0 ml-4">
            <button
              onClick={() => setShowEdit(true)}
              className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 transition-colors cursor-pointer"
            >
              Edit
            </button>
            {hasLineupData && (
              <button
                onClick={handlePrint}
                className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 transition-colors cursor-pointer"
              >
                Print Lineup
              </button>
            )}
            <button
              onClick={handleExport}
              className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 transition-colors cursor-pointer"
            >
              Export Game
            </button>
          </div>
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
          absentPlayersInLineup={absentPlayersInLineup}
          onAssignmentsChange={setWorkingAssignments}
          onBattingOrderChange={setWorkingBattingOrder}
          onDirtyChange={setLineupDirty}
          onLineupGenerated={handleLineupGenerated}
          onSaved={() => void loadAll()}
        />
      )}

      {showEdit && (
        <EditGameForm
          game={game}
          onSave={(updated) => { setGame(updated); setShowEdit(false) }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
