import { forwardRef } from 'react'
import { es } from '../i18n/es'
import { formatCellTooltip } from '../lib/format'
import type { GridCell, Layer } from '../types'

export interface CellTooltipProps {
  cell: GridCell
  layer: Layer
  position: { left: number; top: number }
}

/** Globo con jugadas, % de éxito y métrica de la capa. Posición absoluta en su contenedor. */
export const CellTooltip = forwardRef<HTMLDivElement, CellTooltipProps>(function CellTooltip(
  { cell, layer, position },
  ref,
) {
  const t = formatCellTooltip(cell, layer)
  return (
    <div
      ref={ref}
      role="tooltip"
      data-testid="cell-tooltip"
      style={{ left: position.left, top: position.top }}
      className="pointer-events-none absolute z-20 whitespace-nowrap rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-50 shadow-lg"
    >
      <div>
        {es.tooltip.plays}: {t.plays}
      </div>
      <div>
        {es.tooltip.success}: {t.success}
      </div>
      <div>
        {t.label}: {t.metric}
      </div>
    </div>
  )
})
