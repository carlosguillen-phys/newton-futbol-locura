// Escala de color del mapa de calor (design.md, "Función de color").
// Compartida por las celdas (HeatCells) y la leyenda (ColorLegend), Req. 4.5.

export const COLOR_STOPS = [
  { t: 0, rgb: [253, 224, 71], a: 0 }, // traslúcido (el RGB evita pasar por gris)
  { t: 0.33, rgb: [253, 224, 71], a: 0.55 }, // amarillo
  { t: 0.66, rgb: [249, 115, 22], a: 0.75 }, // naranja
  { t: 1, rgb: [185, 28, 28], a: 0.9 }, // rojo intenso
] as const

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Limita x a [0, 1]. NaN se trata como 0 (Req. 4.4). */
export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

// Forma que devuelve exactamente `from` con u = 0 y exactamente `to` con u = 1.
function lerp(from: number, to: number, u: number): number {
  return from * (1 - u) + to * u
}

/** Interpola linealmente RGB y alfa entre paradas. Con i = 0 el alfa es exactamente 0. */
export function intensityToRgba(i: number): Rgba {
  const x = clamp01(i)
  const last = COLOR_STOPS.length - 1
  let k = 0
  while (k < last - 1 && x > COLOR_STOPS[k + 1].t) k++
  const s0 = COLOR_STOPS[k]
  const s1 = COLOR_STOPS[k + 1]
  const u = (x - s0.t) / (s1.t - s0.t)
  return {
    r: lerp(s0.rgb[0], s1.rgb[0], u),
    g: lerp(s0.rgb[1], s1.rgb[1], u),
    b: lerp(s0.rgb[2], s1.rgb[2], u),
    a: lerp(s0.a, s1.a, u),
  }
}

function toCss({ r, g, b, a }: Rgba): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Number(a.toFixed(3))})`
}

/** Cadena CSS 'rgba(r,g,b,a)' para la intensidad dada. */
export function intensityToCss(i: number): string {
  return toCss(intensityToRgba(i))
}

/** Paradas de gradiente SVG con la misma tabla que las celdas. */
export function legendGradientStops(): { offset: string; color: string }[] {
  return COLOR_STOPS.map((s) => ({
    offset: `${Number((s.t * 100).toFixed(2))}%`,
    color: toCss({ r: s.rgb[0], g: s.rgb[1], b: s.rgb[2], a: s.a }),
  }))
}
