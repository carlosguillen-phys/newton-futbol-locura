import DownYardsChart from './components/DownYardsChart'
import { ErrorBanner } from './components/ErrorBanner'
import FilterPanel from './components/FilterPanel'
import { FootballFieldHeatmap } from './components/FootballFieldHeatmap'
import KpiCards from './components/KpiCards'
import LayerSelector from './components/LayerSelector'
import { MockBadge } from './components/MockBadge'
import { PerspectiveTabs } from './components/PerspectiveTabs'
import { es } from './i18n/es'
import { COVERAGE_OPTIONS, DOWN_OPTIONS, FORMATION_OPTIONS, RESULT_OPTIONS } from './lib/filters'
import { useDashboard } from './state/useDashboard'
import type { FilterOptions } from './types'

export default function App() {
  const { state, setFilters, resetFilters, selectLayer, selectPerspective, retry } = useDashboard()

  const options: FilterOptions = {
    team: state.filterOptions?.teams ?? [],
    down: DOWN_OPTIONS,
    formation: FORMATION_OPTIONS,
    coverage: COVERAGE_OPTIONS,
    result: RESULT_OPTIONS,
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-[2560px] space-y-4 p-4 lg:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-50">{es.appTitle}</h1>
            <p className="text-sm text-slate-300">{es.appSubtitle}</p>
          </div>
          <MockBadge source={state.source} />
        </header>

        {state.error ? <ErrorBanner message={state.error} onRetry={retry} /> : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
          <aside className="min-w-0">
            <FilterPanel
              options={options}
              value={state.filters}
              onChange={setFilters}
              onReset={resetFilters}
              notice={state.filterNotice ? es.filters.fallbackNotice : null}
            />
          </aside>

          <main className="min-w-0 space-y-4">
            <LayerSelector active={state.layer} onSelect={selectLayer} />
            <FootballFieldHeatmap grid={state.data?.grid ?? []} layer={state.layer} loading={state.loading} />
            <KpiCards meta={state.data?.meta} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <DownYardsChart data={state.data?.yards_by_down} />
              <PerspectiveTabs
                value={state.perspective}
                onChange={selectPerspective}
                filters={state.filters}
                meta={state.data?.meta ?? null}
                players={state.data?.top_players ?? []}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
