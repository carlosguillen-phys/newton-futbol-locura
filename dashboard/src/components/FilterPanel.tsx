import { es } from '../i18n/es'
import type { FilterOptions, FilterState } from '../types'

export interface FilterPanelProps {
  options: FilterOptions
  value: FilterState
  onChange: (next: FilterState) => void
  onReset: () => void
  /** Aviso cuando se usan opciones de respaldo; null/undefined lo oculta. */
  notice?: string | null
}

type Key = keyof FilterState

const GROUPS: { key: Key; label: string }[] = [
  { key: 'team', label: es.filters.team },
  { key: 'down', label: es.filters.down },
  { key: 'formation', label: es.filters.formation },
  { key: 'coverage', label: es.filters.coverage },
  { key: 'result', label: es.filters.result },
]

export default function FilterPanel({ options, value, onChange, onReset, notice }: FilterPanelProps) {
  const toggle = (key: Key, option: string) => {
    const current = value[key] as string[]
    const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option]
    onChange({ ...value, [key]: next } as FilterState)
  }

  return (
    <section aria-label={es.filters.title} className="rounded-lg bg-slate-900 p-4 text-slate-100">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-50">{es.filters.title}</h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {es.filters.reset}
        </button>
      </div>

      {notice ? (
        <p role="status" className="mb-3 rounded-md bg-amber-900 px-3 py-2 text-sm text-amber-50">
          {notice}
        </p>
      ) : null}

      <div className="space-y-3">
        {GROUPS.map(({ key, label }) => {
          const opts = options[key] as readonly string[]
          const selected = value[key] as readonly string[]
          return (
            <fieldset key={key} className="min-w-0">
              <legend className="mb-1 text-sm font-medium text-slate-300">{label}</legend>
              <div className="flex flex-wrap gap-2">
                {opts.map((opt) => {
                  const checked = selected.includes(opt)
                  return (
                    <label
                      key={opt}
                      className={`cursor-pointer select-none rounded-md px-2.5 py-1 text-sm focus-within:ring-2 focus-within:ring-emerald-400 ${
                        checked ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggle(key, opt)}
                      />
                      {opt}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        })}
      </div>
    </section>
  )
}
