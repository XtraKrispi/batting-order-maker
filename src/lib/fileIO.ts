import type { Player, Game, InningAssignment, BattingOrderEntry } from '../types'

const INNINGS = [1, 2, 3, 4]

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function printLineup(
  game: Game,
  players: Player[],
  assignments: InningAssignment[],
  battingOrder: BattingOrderEntry[],
): void {
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))
  const sortedOrder = [...battingOrder].sort((a, b) => a.batting_slot - b.batting_slot)
  const orderedPlayerIds =
    sortedOrder.length > 0
      ? sortedOrder.map((e) => e.player_id)
      : [...new Set(assignments.map((a) => a.player_id))]

  const dateStr = escapeHtml(formatDate(game.date))
  const title = game.opponent
    ? `${dateStr} vs. ${escapeHtml(game.opponent)}`
    : dateStr

  const hasSlots = sortedOrder.length > 0

  const rows = orderedPlayerIds
    .map((playerId, idx) => {
      const player = playerMap[playerId]
      const slot = hasSlots ? String(sortedOrder[idx]?.batting_slot ?? '') : ''
      const name = escapeHtml(player?.name ?? playerId)
      const innCells = INNINGS.map((inning) => {
        const a = assignments.find((x) => x.inning === inning && x.player_id === playerId)
        return `<td>${a?.position ?? ''}</td>`
      }).join('')
      return `<tr><td>${slot}</td><td>${name}</td>${innCells}</tr>`
    })
    .join('')

  const isHome = game.is_home !== false
  const usLabel = 'Red Sox'
  const themLabel = game.opponent ? escapeHtml(game.opponent) : 'Them'
  const scoreInningHeaders = INNINGS.map((i) => `<th class="score-cell">${i}</th>`).join('')
  const scoreBlankCells = INNINGS.map(() => `<td class="score-cell"></td>`).join('')
  // Convention: away team on top, home team on bottom
  const [topTeam, bottomTeam] = isHome ? [themLabel, usLabel] : [usLabel, themLabel]

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 20px; color: #000; background: #fff; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { margin: 0 0 12px; font-size: 13px; color: #444; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 5px 10px; text-align: left; background: #fff; color: #000; }
    th { font-weight: bold; }
    td:first-child, th:first-child { text-align: right; width: 2em; }
    .score-table { width: auto; margin-bottom: 16px; }
    .score-table th, .score-table td { text-align: center; }
    .score-table th.team-col, .score-table td.team-col { text-align: left; min-width: 9em; white-space: nowrap; }
    .score-cell { min-width: 2.8em; height: 2em; }
    .score-table td.total-cell { min-width: 3em; font-weight: bold; }
    @media print {
      body { margin: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>${dateStr}</h1>
  ${game.opponent ? `<p class="subtitle">${isHome ? 'vs.' : '@'} ${escapeHtml(game.opponent)}</p>` : '<p class="subtitle">&nbsp;</p>'}
  <table class="score-table">
    <thead>
      <tr>
        <th class="team-col">Team</th>
        ${scoreInningHeaders}
        <th class="score-cell total-cell">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr><td class="team-col">${topTeam}</td>${scoreBlankCells}<td class="total-cell"></td></tr>
      <tr><td class="team-col">${bottomTeam}</td>${scoreBlankCells}<td class="total-cell"></td></tr>
    </tbody>
  </table>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Player</th>
        ${INNINGS.map((i) => `<th>Inning ${i}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=650')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  // Small delay lets the new window fully render before the print dialog opens
  win.setTimeout(() => win.print(), 250)
}

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function readJSONFile<T>(): Promise<T> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file selected'))
      const reader = new FileReader()
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result as string) as T)
        } catch {
          reject(new Error('Invalid JSON file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    }
    input.oncancel = () => reject(new Error('Cancelled'))
    input.click()
  })
}
