import { useState } from 'react'
import type { Player, BattingOrderEntry } from '../../types'
import { saveGameBattingOrder } from '../../lib/store'
import { generateLineup } from '../../lib/lineupGenerator'

interface Props {
  gameId: string
  players: Player[]
  attendingPlayers: Player[]
  battingOrder: BattingOrderEntry[]
  onSaved: () => void
}

export default function BattingOrderPanel({
  gameId,
  players,
  attendingPlayers,
  battingOrder: savedOrder,
  onSaved,
}: Props) {
  const [order, setOrder] = useState<BattingOrderEntry[]>(savedOrder)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))

  const handleGenerate = () => {
    if (attendingPlayers.length === 0) {
      setError('No attending players to generate a batting order for.')
      return
    }
    const { battingOrder } = generateLineup(attendingPlayers, gameId)
    setOrder(battingOrder)
    setDirty(true)
    setError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveGameBattingOrder(gameId, order)
      setDirty(false)
      onSaved()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...order]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    const renumbered = next.map((e, i) => ({ ...e, batting_slot: i + 1 }))
    setOrder(renumbered)
    setDirty(true)
  }

  const moveDown = (index: number) => {
    if (index === order.length - 1) return
    const next = [...order]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    const renumbered = next.map((e, i) => ({ ...e, batting_slot: i + 1 }))
    setOrder(renumbered)
    setDirty(true)
  }

  const sorted = [...order].sort((a, b) => a.batting_slot - b.batting_slot)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={handleGenerate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {order.length > 0 ? 'Regenerate' : 'Generate Batting Order'}
        </button>
        {dirty && order.length > 0 && (
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Order'}
          </button>
        )}
        {order.length > 0 && !dirty && (
          <span className="text-xs text-gray-400 italic">Saved</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {order.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="font-medium">No batting order yet</p>
          <p className="text-sm mt-1">Mark attendance, then generate.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sorted.map((entry, index) => {
            const p = playerMap[entry.player_id]
            return (
              <div
                key={entry.player_id}
                className={`flex items-center px-4 py-2.5 gap-3 ${
                  index < sorted.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <span className="text-lg font-bold text-gray-300 w-7 text-right shrink-0">
                  {entry.batting_slot}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">{p?.name ?? '?'}</span>
                  {p && (
                    <span className="text-xs text-gray-400 ml-2">
                      OFF {p.offense_rank}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === sorted.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
                    title="Move down"
                  >
                    ▼
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
