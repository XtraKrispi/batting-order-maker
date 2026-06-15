import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Game } from '../../types'
import { getGames, createGame, deleteGame, importGame } from '../../lib/store'
import type { GameExport } from '../../lib/store'
import { readJSONFile } from '../../lib/fileIO'

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface AddGameFormProps {
  onSave: (data: Omit<Game, 'id' | 'created_at'>) => void
  onCancel: () => void
}

function AddGameForm({ onSave, onCancel }: AddGameFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ date: today, opponent: '', notes: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      date: form.date,
      opponent: form.opponent.trim() || null,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Game</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
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
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
            >
              Add Game
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GamesList() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try {
      setLoading(true)
      setGames(await getGames())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleAdd = async (data: Omit<Game, 'id' | 'created_at'>) => {
    try {
      const game = await createGame(data)
      setShowForm(false)
      navigate(`/games/${game.id}`)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleImport = async () => {
    try {
      const data = await readJSONFile<GameExport>()
      if (data.version !== 1 || !data.game?.id) {
        setError('Invalid game file.')
        return
      }
      importGame(data)
      navigate(`/games/${data.game.id}`)
    } catch (e) {
      if (String(e).includes('Cancelled')) return
      setError(String(e))
    }
  }

  const handleDelete = async (e: React.MouseEvent, game: Game) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete game on ${formatDate(game.date)}?`)) return
    try {
      await deleteGame(game.id)
      await load()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Games</h1>
        <div className="flex gap-2">
          <button
            onClick={() => void handleImport()}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Import Game
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Game
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading games…</div>
      ) : games.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No games yet</p>
          <p className="text-sm mt-1">Add your first game to generate a lineup.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((game) => (
            <Link
              key={game.id}
              to={`/games/${game.id}`}
              className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                    {formatDate(game.date)}
                  </p>
                  {game.opponent && (
                    <p className="text-sm text-gray-500 mt-0.5">vs. {game.opponent}</p>
                  )}
                  {game.notes && (
                    <p className="text-sm text-gray-400 mt-0.5 italic">{game.notes}</p>
                  )}
                </div>
                <button
                  onClick={(e) => void handleDelete(e, game)}
                  className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <AddGameForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
      )}
    </div>
  )
}
