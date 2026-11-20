import { es } from '../i18n/es'
import type { DataSource } from '../types'

export interface MockBadgeProps {
  source: DataSource
}

/** Muestra "Datos simulados" solo cuando los datos provienen del mock. */
export function MockBadge({ source }: MockBadgeProps) {
  if (source !== 'mock') return null
  return (
    <span
      role="status"
      data-testid="mock-badge"
      className="inline-flex items-center rounded-full border border-amber-300 bg-amber-950 px-3 py-1 text-sm font-semibold text-amber-200"
    >
      {es.mockBadge}
    </span>
  )
}
