export type Layer = 'targets' | 'routes' | 'pocket_pressure' | 'separation'
export type PassResult = 'C' | 'I' | 'S' | 'R' | 'IN'
export type Down = '1st' | '2nd' | '3rd' | '4th'
export type Formation = 'SHOTGUN' | 'EMPTY' | 'SINGLEBACK' | 'I_FORM'
export type Coverage = 'Cover-1' | 'Cover-2' | 'Cover-3' | 'Quarters' | 'Man vs Zone'
export type Position = 'QB' | 'WR' | 'TE' | 'RB' | 'CB' | 'S'
export type Perspective = 'coach' | 'scout' | 'broadcaster'

/** Arreglo vacío = sin selección = todas las opciones. */
export interface FilterState {
  team: string[]
  down: Down[]
  formation: Formation[]
  coverage: Coverage[]
  result: PassResult[]
}

export interface Meta {
  total_plays: number
  avg_yards: number
  completion_pct: number
  sack_rate: number
  avg_time_to_throw: number
}

export interface GridCell {
  /** Borde izquierdo en yardas, 0 a 115 en pasos de 5. */
  x_bin: number
  /** Borde superior en yardas, k * 5.33 para k = 0..9. */
  y_bin: number
  /** 0 a 1 */
  intensity: number
  /** Entero >= 0 */
  plays_count: number
  /** 0 a 1 */
  success_rate: number
  avg_epa_or_yards: number
}

export interface TopPlayer {
  nflId: number
  name: string
  position: Position
  metric_value: number
  metric_label: string
}

export interface DownYards {
  down: 1 | 2 | 3 | 4
  avg_yards: number
}

export interface HeatmapResponse {
  meta: Meta
  grid: GridCell[]
  top_players: TopPlayer[]
  /** Extensión opcional del contrato. */
  yards_by_down?: DownYards[]
}

export interface FiltersResponse {
  teams: string[]
}

export type DataSource = 'api' | 'mock'

export interface ApiResult<T> {
  data: T
  source: DataSource
}

export interface FilterOptions {
  team: string[]
  down: readonly Down[]
  formation: readonly Formation[]
  coverage: readonly Coverage[]
  result: readonly PassResult[]
}

export interface MockFile {
  filters: FiltersResponse
  layers: Record<Layer, HeatmapResponse>
}
