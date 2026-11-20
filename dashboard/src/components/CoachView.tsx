import { useMemo } from 'react'
import { es } from '../i18n/es'
import { coachRecommendation } from '../lib/insights'
import type { FilterState, Meta } from '../types'

interface CoachViewProps {
  filters: FilterState
  meta: Meta | null
}

/** Recomendación táctica regenerada cuando cambian filtros o meta (Req. 9.2, 9.3, 9.9). */
export function CoachView({ filters, meta }: CoachViewProps) {
  const text = useMemo(() => {
    try {
      return coachRecommendation(filters, meta)
    } catch {
      return null
    }
  }, [filters, meta])

  return (
    <section aria-labelledby="coach-title" data-testid="coach-view" className="space-y-2">
      <h3 id="coach-title" className="text-sm font-semibold text-slate-100">
        {es.coach.title}
      </h3>
      {text === null ? (
        <p role="status" className="text-sm text-amber-300">
          {es.errors.recommendationUnavailable}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-200">{text}</p>
      )}
    </section>
  )
}
