import { FIELD_H, FIELD_W, hashMarks, yardLineXs, yardNumbers } from '../lib/fieldGeometry'

const END_ZONE_W = 10

/** Marcas del campo en yardas. Se coloca dentro de un <svg viewBox="0 0 120 53.3">. */
export function FieldMarkings() {
  return (
    <g data-testid="field-markings">
      <rect x={0} y={0} width={FIELD_W} height={FIELD_H} fill="#2f7d3a" />
      <rect x={0} y={0} width={END_ZONE_W} height={FIELD_H} fill="#1e4f8f" />
      <rect x={FIELD_W - END_ZONE_W} y={0} width={END_ZONE_W} height={FIELD_H} fill="#8f1e2e" />
      {yardLineXs.map((x) => (
        <line
          key={`yl-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={FIELD_H}
          stroke="#ffffff"
          strokeWidth={x % 10 === 0 ? 0.3 : 0.15}
          strokeOpacity={0.85}
        />
      ))}
      {hashMarks().map((m) => (
        <line
          key={`h-${m.x}-${m.y}`}
          x1={m.x}
          y1={m.y - 0.4}
          x2={m.x}
          y2={m.y + 0.4}
          stroke="#ffffff"
          strokeWidth={0.12}
          strokeOpacity={0.8}
        />
      ))}
      {yardNumbers.map((n) => (
        <g key={`n-${n.x}`}>
          <text
            x={n.x}
            y={9}
            fontSize={3}
            fill="#ffffff"
            fillOpacity={0.8}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {n.label}
          </text>
          <text
            x={n.x}
            y={FIELD_H - 9}
            fontSize={3}
            fill="#ffffff"
            fillOpacity={0.8}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {n.label}
          </text>
        </g>
      ))}
      <path
        d="M 54 26.65 L 64 26.65 M 61.6 24.9 L 64 26.65 L 61.6 28.4"
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.9}
      />
    </g>
  )
}
