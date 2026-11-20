import { clamp01 } from '../lib/color'
import { COVERAGE_OPTIONS, DOWN_OPTIONS, FORMATION_OPTIONS, RESULT_OPTIONS } from '../lib/filters'
import type {
  FilterOptions,
  FilterState,
  FiltersResponse,
  GridCell,
  HeatmapResponse,
  Layer,
  MockFile,
} from '../types'
import mockData from './heatmapMock.json'
import { hash32 } from './prng'

const MOCK = mockData as unknown as MockFile

const DIMENSIONS = ['team', 'down', 'formation', 'coverage', 'result'] as const
type Dim = (typeof DIMENSIONS)[number]

const U32 = 4294967296
const round1 = (x: number): number => Math.round(x * 10) / 10
const round2 = (x: number): number => Math.round(x * 100) / 100
const clampPct = (x: number): number => Math.min(100, Math.max(0, x))
const unit = (s: string): number => hash32(s) / U32

export function getMockFilters(): FiltersResponse {
  return { teams: [...MOCK.filters.teams] }
}

function defaultOptions(): FilterOptions {
  return {
    team: getMockFilters().teams,
    down: DOWN_OPTIONS,
    formation: FORMATION_OPTIONS,
    coverage: COVERAGE_OPTIONS,
    result: RESULT_OPTIONS,
  }
}

/**
 * Quita duplicados (conserva el orden de primera aparición) y convierte en vacía
 * toda dimensión con todas sus opciones seleccionadas (Req. 7.8). Idempotente.
 */
export function normalizeFilters(f: FilterState, options: FilterOptions = defaultOptions()): FilterState {
  const out = { team: [], down: [], formation: [], coverage: [], result: [] } as FilterState
  for (const d of DIMENSIONS) {
    const values = Array.from(new Set(f[d] as string[]))
    const opts = options[d] as readonly string[]
    const full = opts.length > 0 && opts.every((o) => values.includes(o))
    ;(out[d] as string[]) = full ? [] : values
  }
  return out
}

function isEmpty(n: FilterState): boolean {
  return DIMENSIONS.every((d) => n[d].length === 0)
}

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/** Respuesta simulada determinista para los filtros y la capa dados (Req. 7.1, 7.11). */
export function buildMockResponse(f: FilterState, layer: Layer): HeatmapResponse {
  const base = MOCK.layers[layer]
  const n = normalizeFilters(f)
  if (isEmpty(n)) return base

  // Sal por dimensión: evita que dos dimensiones con el mismo valor produzcan el mismo factor.
  const selected: { d: Dim; v: string; salt: string }[] = []
  DIMENSIONS.forEach((d, di) => {
    for (const v of n[d] as string[]) selected.push({ d, v, salt: `${d}#${di}:${v}` })
  })

  const G = avg(selected.map((s) => 0.6 + 0.8 * unit(s.salt)))

  const cellFactor = (i: number): number =>
    avg(selected.map((s) => 0.7 + 0.6 * unit(`${s.salt}:${layer}:${i}`)))

  const grid: GridCell[] = base.grid.map((c, i) => {
    const Ci = cellFactor(i)
    return {
      ...c,
      plays_count: Math.max(0, Math.round(c.plays_count * G * Ci)),
      intensity: clamp01(c.intensity * Ci),
      success_rate: clamp01(c.success_rate + 0.08 * (Ci - 1)),
      avg_epa_or_yards: round1(c.avg_epa_or_yards * Ci),
    }
  })

  // Garantiza al menos una celda distinta de la base.
  const cellChanged = grid.some((c, i) => {
    const b = base.grid[i]
    return (
      c.plays_count !== b.plays_count ||
      c.intensity !== b.intensity ||
      c.success_rate !== b.success_rate ||
      c.avg_epa_or_yards !== b.avg_epa_or_yards
    )
  })
  if (!cellChanged && grid.length > 0) {
    grid[0] = { ...grid[0], plays_count: grid[0].plays_count + 1 }
  }

  const sum = grid.reduce((a, c) => a + c.plays_count, 0)
  const bm = base.meta
  const shift = G - 1
  const meta = {
    total_plays: Math.max(sum, Math.round(bm.total_plays * G)),
    avg_yards: Math.max(0, round1(bm.avg_yards * (1 + 0.5 * shift))),
    completion_pct: clampPct(round2(bm.completion_pct + 10 * shift)),
    sack_rate: clampPct(Math.round(bm.sack_rate * (1 - 0.5 * shift) * 100) / 100),
    avg_time_to_throw: Math.max(0.1, round2(bm.avg_time_to_throw * (1 + 0.1 * shift))),
  }
  // Garantiza al menos un KPI distinto de la base.
  const kpiChanged =
    meta.total_plays !== bm.total_plays ||
    meta.avg_yards !== bm.avg_yards ||
    meta.completion_pct !== bm.completion_pct ||
    meta.sack_rate !== bm.sack_rate ||
    meta.avg_time_to_throw !== bm.avg_time_to_throw
  if (!kpiChanged) meta.total_plays = bm.total_plays + 1

  const top_players = base.top_players.map((p) => {
    const Gp = avg(selected.map((s) => 0.6 + 0.8 * unit(`${s.salt}:${p.nflId}`)))
    return { ...p, metric_value: round1(p.metric_value * Gp) }
  })

  const result: HeatmapResponse = { meta, grid, top_players }
  if (base.yards_by_down) {
    result.yards_by_down = base.yards_by_down.map((y) => ({
      ...y,
      avg_yards: Math.max(0, round1(y.avg_yards * (1 + 0.5 * shift))),
    }))
  }
  return result
}
