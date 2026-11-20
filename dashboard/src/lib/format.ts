import { es } from '../i18n/es'
import type { DownYards, GridCell, Layer, Meta } from '../types'
import { LAYER_INFO } from './layers'

export interface CellTooltipText {
  plays: string
  success: string
  metric: string
  label: string
}

/** Texto del tooltip de una celda. Con 0 jugadas muestra "Sin datos". */
export function formatCellTooltip(cell: GridCell, layer: Layer): CellTooltipText {
  const label = LAYER_INFO[layer].metricLabel
  if (!(cell.plays_count > 0)) {
    return { plays: '0', success: es.noData, metric: es.noData, label }
  }
  return {
    plays: String(Math.round(cell.plays_count)),
    success: `${(cell.success_rate * 100).toFixed(1)} %`,
    metric: cell.avg_epa_or_yards.toFixed(1),
    label,
  }
}

export interface KpiCard {
  key: keyof Meta
  label: string
  unit: string
  text: string
}

type KpiSpec = { key: keyof Meta; kind: 'int' | 'd1' | 'd2'; pct?: boolean }

const KPI_SPECS: readonly KpiSpec[] = [
  { key: 'total_plays', kind: 'int' },
  { key: 'avg_yards', kind: 'd1' },
  { key: 'completion_pct', kind: 'd1', pct: true },
  { key: 'sack_rate', kind: 'd1', pct: true },
  { key: 'avg_time_to_throw', kind: 'd2' },
]

function formatValue(v: unknown, spec: KpiSpec): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return es.notAvailable
  if (spec.pct && (v < 0 || v > 100)) return es.notAvailable
  if (spec.kind === 'int') return v < 0 ? es.notAvailable : String(Math.round(v))
  return v.toFixed(spec.kind === 'd1' ? 1 : 2)
}

/** Cinco tarjetas KPI; un campo inválido muestra "N/D" sin afectar a los demás. */
export function formatKpis(meta: Partial<Record<keyof Meta, unknown>> | null | undefined): KpiCard[] {
  const m = meta ?? {}
  return KPI_SPECS.map((spec) => ({
    key: spec.key,
    label: es.kpi[spec.key].label,
    unit: es.kpi[spec.key].unit,
    text: formatValue(m[spec.key], spec),
  }))
}

/** Datos de la gráfica: máximo 4 downs, ordenados, sin duplicados. */
export function toBarData(yardsByDown?: DownYards[] | null): { down: string; avg_yards: number }[] {
  if (!Array.isArray(yardsByDown)) return []
  const seen = new Map<number, number>()
  for (const item of yardsByDown) {
    if (!item || ![1, 2, 3, 4].includes(item.down)) continue
    if (typeof item.avg_yards !== 'number' || !Number.isFinite(item.avg_yards)) continue
    if (!seen.has(item.down)) seen.set(item.down, item.avg_yards)
  }
  return [...seen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([down, avg_yards]) => ({ down: String(down), avg_yards }))
}
