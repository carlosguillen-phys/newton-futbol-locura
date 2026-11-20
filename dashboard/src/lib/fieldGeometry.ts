import type { GridCell } from '../types'

/** Ancho total del campo en yardas (incluye end zones). */
export const FIELD_W = 120
/** Alto del campo en yardas. */
export const FIELD_H = 53.3
/** Ancho de una celda en yardas. */
export const CELL_W = 5
/** Alto de una celda en yardas. */
export const CELL_H = 5.33

/** Ancho mínimo del campo en píxeles. */
const MIN_WIDTH = 320

/** Filas de hash marks en yardas (de arriba hacia abajo). */
const HASH_ROW_YS: readonly number[] = [23.58, 29.72]

/** Posiciones x de las 21 líneas de yarda: 10, 15, …, 110. */
export const yardLineXs: number[] = Array.from({ length: 21 }, (_, i) => 10 + i * 5)

const YARD_LABELS = [10, 20, 30, 40, 50, 40, 30, 20, 10]

/** Números de yarda en x = 20, 30, …, 100. */
export const yardNumbers: { x: number; label: string }[] = YARD_LABELS.map((n, i) => ({
  x: 20 + i * 10,
  label: String(n),
}))

/** Hash marks: para cada x entero de 10 a 110, una marca en cada fila. */
export function hashMarks(): { x: number; y: number }[] {
  const marks: { x: number; y: number }[] = []
  for (const y of HASH_ROW_YS) {
    for (let x = 10; x <= 110; x++) marks.push({ x, y })
  }
  return marks
}

/** Rectángulo de una celda en coordenadas del campo. */
export function cellRect(c: Pick<GridCell, 'x_bin' | 'y_bin'>): {
  x: number
  y: number
  w: number
  h: number
} {
  return { x: c.x_bin, y: c.y_bin, w: CELL_W, h: CELL_H }
}

/** Tamaño en píxeles del campo: ancho mínimo 320 y relación 120:53.3. */
export function fieldSize(containerWidth: number): { width: number; height: number } {
  const w = Number.isFinite(containerWidth) ? containerWidth : MIN_WIDTH
  const width = Math.max(w, MIN_WIDTH)
  return { width, height: (width * FIELD_H) / FIELD_W }
}
