import { useState, useEffect } from 'react'
import type { Player } from '../../types'

interface Props {
  player?: Player
  onSave: (data: Omit<Player, 'id' | 'created_at'> & { id?: string }) => void
  onCancel: () => void
}

const defaultForm = {
  name: '',
  jersey_number: '' as number | '',
  offense_rank: 5,
  defense_rank: 5,
  active: true,
}

function RankSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{' '}
        <span className="font-bold text-blue-700">{value}</span>
        <span className="text-gray-400 font-normal"> / 10</span>
      </label>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>1 – Weakest</span>
        <span>10 – Strongest</span>
      </div>
    </div>
  )
}

export default function PlayerForm({ player, onSave, onCancel }: Props) {
  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    if (player) {
      setForm({
        name: player.name,
        jersey_number: player.jersey_number ?? '',
        offense_rank: player.offense_rank,
        defense_rank: player.defense_rank,
        active: player.active,
      })
    } else {
      setForm(defaultForm)
    }
  }, [player])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...(player?.id ? { id: player.id } : {}),
      name: form.name.trim(),
      jersey_number: form.jersey_number === '' ? null : Number(form.jersey_number),
      offense_rank: form.offense_rank,
      defense_rank: form.defense_rank,
      active: form.active,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {player ? 'Edit Player' : 'Add Player'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Player name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jersey Number
            </label>
            <input
              type="number"
              min={0}
              max={99}
              value={form.jersey_number}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  jersey_number: e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>

          <RankSlider
            label="Offense Rank"
            value={form.offense_rank}
            onChange={(v) => setForm((f) => ({ ...f, offense_rank: v }))}
          />
          <RankSlider
            label="Defense Rank"
            value={form.defense_rank}
            onChange={(v) => setForm((f) => ({ ...f, defense_rank: v }))}
          />

          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="accent-blue-600"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
              Active (included in future games)
            </label>
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
              {player ? 'Save Changes' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
