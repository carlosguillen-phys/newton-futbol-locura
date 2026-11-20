import { es } from '../i18n/es'
import type { FilterState, Meta, Perspective, TopPlayer } from '../types'
import { BroadcasterView } from './BroadcasterView'
import { CoachView } from './CoachView'
import { ScoutView } from './ScoutView'

interface PerspectiveTabsProps {
  value: Perspective
  onChange: (p: Perspective) => void
  filters: FilterState
  meta: Meta | null
  players: readonly TopPlayer[]
}

const OPTIONS: Perspective[] = ['coach', 'scout', 'broadcaster']

/** Selector de 3 perspectivas; solo la vista activa se renderiza (Req. 9.1, 9.8). */
export function PerspectiveTabs({ value, onChange, filters, meta, players }: PerspectiveTabsProps) {
  return (
    <div className="rounded-lg bg-slate-800 p-4">
      <div role="tablist" aria-label={es.perspectives.title} className="mb-3 flex gap-2">
        {OPTIONS.map((p) => {
          const active = p === value
          return (
            <button
              key={p}
              type="button"
              role="tab"
              id={`tab-${p}`}
              aria-selected={active}
              aria-controls="perspective-panel"
              onClick={() => onChange(p)}
              className={
                'rounded px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ' +
                (active
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-700 text-slate-100 hover:bg-slate-600')
              }
            >
              {es.perspectives[p]}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id="perspective-panel" aria-labelledby={`tab-${value}`}>
        {value === 'coach' && <CoachView filters={filters} meta={meta} />}
        {value === 'scout' && <ScoutView players={players} />}
        {value === 'broadcaster' && <BroadcasterView meta={meta} />}
      </div>
    </div>
  )
}
