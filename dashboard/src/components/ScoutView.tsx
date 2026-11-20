import { useMemo, useState } from 'react'
import { es } from '../i18n/es'
import { sortPlayers, visiblePlayers } from '../lib/players'
import type { SortDir } from '../lib/players'
import type { TopPlayer } from '../types'

interface ScoutViewProps {
  players: readonly TopPlayer[]
}

/** Tabla de hasta 20 jugadores ordenable por metric_value (Req. 9.4, 9.5, 9.7). */
export function ScoutView({ players }: ScoutViewProps) {
  // null = sin ordenar; primera activación -> 'desc', luego alterna.
  const [dir, setDir] = useState<SortDir | null>(null)

  const rows = useMemo(() => {
    const visible = visiblePlayers(players)
    return dir === null ? visible : sortPlayers(visible, dir)
  }, [players, dir])

  const toggle = () => setDir((d) => (d === null || d === 'asc' ? 'desc' : 'asc'))

  if (players.length === 0) {
    return (
      <p data-testid="scout-view" role="status" className="text-sm text-slate-300">
        {es.noTopPlayers}
      </p>
    )
  }

  const ariaSort = dir === null ? 'none' : dir === 'desc' ? 'descending' : 'ascending'
  const arrow = dir === 'desc' ? ' ▼' : dir === 'asc' ? ' ▲' : ''

  return (
    <div data-testid="scout-view" className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-200">
        <thead>
          <tr className="border-b border-slate-600 text-slate-100">
            <th scope="col" className="px-2 py-1 font-semibold">{es.scout.name}</th>
            <th scope="col" className="px-2 py-1 font-semibold">{es.scout.position}</th>
            <th scope="col" className="px-2 py-1 font-semibold">{es.scout.metricLabel}</th>
            <th scope="col" aria-sort={ariaSort} className="px-2 py-1 text-right font-semibold">
              <button
                type="button"
                onClick={toggle}
                className="rounded px-1 font-semibold text-slate-100 hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {es.scout.metricValue}
                {arrow}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.nflId} className="border-b border-slate-700">
              <td className="px-2 py-1">{p.name}</td>
              <td className="px-2 py-1">{p.position}</td>
              <td className="px-2 py-1">{p.metric_label}</td>
              <td className="px-2 py-1 text-right tabular-nums">{p.metric_value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
