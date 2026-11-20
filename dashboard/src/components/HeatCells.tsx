import { cellRect } from '../lib/fieldGeometry'
import { intensityToCss } from '../lib/color'
import type { GridCell } from '../types'

interface HeatCellsProps {
  cells: GridCell[]
  onCellEnter?: (cell: GridCell) => void
  onCellLeave?: () => void
}

/** Un <rect> por celda, en yardas. Se coloca dentro de un <svg viewBox="0 0 120 53.3">. */
export function HeatCells({ cells, onCellEnter, onCellLeave }: HeatCellsProps) {
  return (
    <g data-testid="heat-cells">
      {cells.map((c) => {
        const r = cellRect(c)
        return (
          <rect
            key={`${c.x_bin}-${c.y_bin}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={intensityToCss(c.intensity)}
            onMouseEnter={onCellEnter ? () => onCellEnter(c) : undefined}
            onMouseLeave={onCellLeave}
          />
        )
      })}
    </g>
  )
}
