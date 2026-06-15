import type { Player, GameAttendance } from '../../types'
import { setPlayerAttendance } from '../../lib/store'

interface Props {
  gameId: string
  players: Player[]
  attendance: GameAttendance[]
  onChange: () => void
}

function isAbsent(attendance: GameAttendance[], playerId: string): boolean {
  const record = attendance.find((a) => a.player_id === playerId)
  return record?.attending === false
}

export default function AttendancePanel({ gameId, players, attendance, onChange }: Props) {
  const handleToggle = async (playerId: string, currentlyAbsent: boolean) => {
    await setPlayerAttendance(gameId, playerId, currentlyAbsent ? null : false)
    onChange()
  }

  const absent = players.filter((p) => isAbsent(attendance, p.id)).length
  const present = players.length - absent

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
        <span className="text-green-600 font-medium">{present} in</span>
        <span className="text-red-500 font-medium">{absent} out</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {players.map((player, i) => {
          const absent = isAbsent(attendance, player.id)
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between px-4 py-3 ${
                i < players.length - 1 ? 'border-b border-gray-100' : ''
              } ${absent ? 'bg-red-50/30' : ''}`}
            >
              <div className="flex items-center gap-3">
                {player.jersey_number != null && (
                  <span className="text-xs text-gray-400 font-mono w-5 text-right">
                    {player.jersey_number}
                  </span>
                )}
                <span className={`font-medium ${absent ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {player.name}
                </span>
              </div>
              <button
                onClick={() => void handleToggle(player.id, absent)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  absent
                    ? 'bg-red-400 text-white border-transparent'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                Out
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
