import type { TopPlayer } from '../types'

export type SortDir = 'asc' | 'desc'

export const MAX_VISIBLE_PLAYERS = 20

/** Primeros 20 jugadores. */
export function visiblePlayers(players: readonly TopPlayer[]): TopPlayer[] {
  return players.slice(0, MAX_VISIBLE_PLAYERS)
}

/** Copia ordenada por `metric_value`; no modifica la entrada. */
export function sortPlayers(players: readonly TopPlayer[], dir: SortDir): TopPlayer[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...players].sort((a, b) => sign * (a.metric_value - b.metric_value))
}
