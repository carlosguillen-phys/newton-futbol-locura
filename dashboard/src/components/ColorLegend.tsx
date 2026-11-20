import { legendGradientStops } from '../lib/color'
import { es } from '../i18n/es'

const GRADIENT_ID = 'heat-legend-gradient'

/** Leyenda de intensidad: gradiente horizontal con etiquetas "0" y "1". */
export function ColorLegend() {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <span>{es.layers.legendMin}</span>
      <svg
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="h-3 w-40 rounded border border-slate-300 bg-white"
        role="img"
        aria-label={es.layers.legend}
      >
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
            {legendGradientStops().map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={100} height={10} fill={`url(#${GRADIENT_ID})`} />
      </svg>
      <span>{es.layers.legendMax}</span>
    </div>
  )
}
