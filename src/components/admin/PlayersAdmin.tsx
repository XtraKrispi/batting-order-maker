import { useState, useEffect } from 'react'
import type { Player } from '../../types'
import { getPlayers, upsertPlayer, deletePlayer, loadRoster } from '../../lib/store'
import { downloadJSON, readJSONFile } from '../../lib/fileIO'
import PlayerForm from './PlayerForm'

const RankBadge = ({ value, color }: { value: number; color: string }) => (
  <span
    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${color}`}
  >
    {value}
  </span>
)

export default function PlayersAdmin() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | undefined>()
  const [showInactive, setShowInactive] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setPlayers(await getPlayers())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleSave = async (data: Omit<Player, 'id' | 'created_at'> & { id?: string }) => {
    try {
      await upsertPlayer(data)
      setShowForm(false)
      setEditingPlayer(undefined)
      await load()
    } catch (e) {
      setError(String(e))
    }
  }

  const handleDelete = async (player: Player) => {
    if (!confirm(`Remove ${player.name} from the roster?`)) return
    try {
      await deletePlayer(player.id)
      await load()
    } catch (e) {
      setError(String(e))
    }
  }

  const handleExport = async () => {
    const all = await getPlayers()
    downloadJSON(all, 'roster.json')
  }

  const handleImport = async () => {
    try {
      const data = await readJSONFile<Player[]>()
      if (!Array.isArray(data) || !data.every((p) => p.id && p.name)) {
        setError('Invalid roster file.')
        return
      }
      if (!confirm(`Replace the current roster with ${data.length} imported players?`)) return
      loadRoster(data)
      await load()
    } catch (e) {
      if (String(e).includes('Cancelled')) return
      setError(String(e))
    }
  }

  const openAdd = () => {
    setEditingPlayer(undefined)
    setShowForm(true)
  }

  const openEdit = (p: Player) => {
    setEditingPlayer(p)
    setShowForm(true)
  }

  const visible = showInactive ? players : players.filter((p) => p.active)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roster</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {players.filter((p) => p.active).length} active players
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handleExport()}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Export Roster
          </button>
          <button
            onClick={() => void handleImport()}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Import Roster
          </button>
          <button
            onClick={openAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Player
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading roster…</div>
      ) : players.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No players yet</p>
          <p className="text-sm mt-1">Add your first player to get started.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 text-center">Offense</th>
                  <th className="px-4 py-3 text-center">Defense</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((p) => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${!p.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-gray-400 font-mono">
                      {p.jersey_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-center">
                      <RankBadge
                        value={p.offense_rank}
                        color={
                          p.offense_rank >= 8
                            ? 'bg-green-600'
                            : p.offense_rank >= 5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RankBadge
                        value={p.defense_rank}
                        color={
                          p.defense_rank >= 8
                            ? 'bg-blue-600'
                            : p.defense_rank >= 5
                            ? 'bg-indigo-400'
                            : 'bg-gray-400'
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleDelete(p)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {players.some((p) => !p.active) && (
            <button
              onClick={() => setShowInactive((v) => !v)}
              className="mt-3 text-sm text-gray-500 hover:underline"
            >
              {showInactive ? 'Hide inactive players' : 'Show inactive players'}
            </button>
          )}
        </>
      )}

      {showForm && (
        <PlayerForm
          player={editingPlayer}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditingPlayer(undefined)
          }}
        />
      )}
    </div>
  )
}
