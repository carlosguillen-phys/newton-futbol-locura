import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { es } from '../i18n/es'
import { FIELD_H, FIELD_W } from '../lib/fieldGeometry'
import { tooltipPosition } from '../lib/tooltip'
import type { GridCell, Layer } from '../types'
import { CellTooltip } from './CellTooltip'
import { ColorLegend } from './ColorLegend'
import { FieldMarkings } from './FieldMarkings'
import { HeatCells } from './HeatCells'
import { LoadingOverlay } from './LoadingOverlay'

export interface FootballFieldHeatmapProps {
  grid: GridCell[]
  layer: Layer
  loading: boolean
}

export function FootballFieldHeatmap({ grid, layer, loading }: FootballFieldHeatmapProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<GridCell | null>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ left: 0, top: 0 })

  const onMouseMove = useCallback((e: MouseEvent) => {
    const box = boxRef.current
    if (!box) return
    const r = box.getBoundingClientRect()
    setCursor({ x: e.clientX - r.left, y: e.clientY - r.top })
  }, [])

  const onCellEnter = useCallback((c: GridCell) => setHovered(c), [])
  const onCellLeave = useCallback(() => setHovered(null), [])

  useLayoutEffect(() => {
    const box = boxRef.current
    const tip = tipRef.current
    if (!hovered || !box || !tip) return
    const next = tooltipPosition(
      cursor,
      { w: tip.offsetWidth, h: tip.offsetHeight },
      { w: box.clientWidth, h: box.clientHeight },
    )
    setPosition((p) => (p.left === next.left && p.top === next.top ? p : next))
  }, [hovered, cursor])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-x-auto" data-testid="field-container">
        <div
          ref={boxRef}
          className="relative min-w-[320px]"
          onMouseMove={onMouseMove}
          onMouseLeave={onCellLeave}
        >
          <svg
            viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={es.field.alt}
            className="block"
          >
            <FieldMarkings />
            <HeatCells cells={grid} onCellEnter={onCellEnter} onCellLeave={onCellLeave} />
          </svg>
          {hovered && <CellTooltip ref={tipRef} cell={hovered} layer={layer} position={position} />}
        </div>
        <LoadingOverlay visible={loading} />
      </div>
      <ColorLegend />
    </div>
  )
}
