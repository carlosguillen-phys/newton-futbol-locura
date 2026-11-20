import { useMemo } from 'react'
import { es } from '../i18n/es'
import { broadcastSummary } from '../lib/insights'
import type { Meta } from '../types'

interface BroadcasterViewProps {
  meta: Meta | null
}

/** Resumen ejecutivo de una sola frase (Req. 9.6). */
export function BroadcasterView({ meta }: BroadcasterViewProps) {
  const text = useMemo(() => {
    try {
      return broadcastSummary(meta)
    } catch {
      return null
    }
  }, [meta])

  return (
    <section aria-labelledby="broadcaster-title" data-testid="broadcaster-view" className="space-y-2">
      <h3 id="broadcaster-title" className="text-sm font-semibold text-slate-100">
        {es.broadcaster.title}
      </h3>
      {text === null ? (
        <p role="status" className="text-sm text-amber-300">
          {es.errors.summaryUnavailable}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-200">{text}</p>
      )}
    </section>
  )
}
