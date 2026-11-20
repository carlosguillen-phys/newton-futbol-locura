export interface Point { x: number; y: number }
export interface Size { w: number; h: number }

function clampAxis(preferred: number, tip: number, box: number, margin: number): number {
  const max = box - tip - margin
  if (max < margin) return margin // no cabe: se fija en el margen
  return Math.min(Math.max(preferred, margin), max)
}

/** Posición del tooltip: cursor + offset, acotada por eje dentro del contenedor. */
export function tooltipPosition(
  cursor: Point,
  tip: Size,
  box: Size,
  offset = 12,
  margin = 4,
): { left: number; top: number } {
  return {
    left: clampAxis(cursor.x + offset, tip.w, box.w, margin),
    top: clampAxis(cursor.y + offset, tip.h, box.h, margin),
  }
}
