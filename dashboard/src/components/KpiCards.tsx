import { formatKpis } from '../lib/format'
import type { Meta } from '../types'

interface KpiCardsProps {
  meta: Partial<Record<keyof Meta, unknown>> | null | undefined
}

export default function KpiCards({ meta }: KpiCardsProps) {
  const cards = formatKpis(meta)
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <li
          key={card.key}
          data-testid={`kpi-${card.key}`}
          className="rounded-lg border border-slate-700 bg-slate-800 p-4"
        >
          <p className="text-sm text-slate-300">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-50">{card.text}</p>
          <p className="text-xs text-slate-300">{card.unit}</p>
        </li>
      ))}
    </ul>
  )
}
