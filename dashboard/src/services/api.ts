import type {
  ApiResult,
  Coverage,
  Down,
  FilterState,
  FiltersResponse,
  Formation,
  HeatmapResponse,
  Layer,
  PassResult,
} from '../types'
import { validateHeatmapResponse } from '../lib/validate'
import { LAYERS } from '../lib/layers'
import { buildMockResponse, getMockFilters } from '../mocks/mockEngine'

/** Con true no se hace ninguna petición de red (Req. 1.6). */
export const USE_MOCK = false

export const HEATMAP_TIMEOUT_MS = 10_000
export const FILTERS_TIMEOUT_MS = 5_000

const HEATMAP_ROUTE = 'api/heatmap'
const FILTERS_ROUTE = 'api/filters'

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>

/** Opciones inyectables, pensadas para pruebas. */
export interface ApiOptions {
  useMock?: boolean
  fetchImpl?: FetchLike
  /** Plazo en milisegundos; sustituye al de cada endpoint. */
  timeoutMs?: number
}

const DIMENSIONS = ['team', 'down', 'formation', 'coverage', 'result'] as const

/** Construye `api/heatmap?layer=...&team=A,B...` (relativa, sin filtros vacíos). */
export function buildHeatmapUrl(f: FilterState, layer: Layer): string {
  const parts = [`layer=${encodeURIComponent(layer)}`]
  for (const d of DIMENSIONS) {
    const values = f[d] as string[]
    if (values.length > 0) parts.push(`${d}=${values.map(encodeURIComponent).join(',')}`)
  }
  return `${HEATMAP_ROUTE}?${parts.join('&')}`
}

/** Inversa de `buildHeatmapUrl`. */
export function parseHeatmapUrl(url: string): { filters: FilterState; layer: Layer } {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
  const filters: FilterState = { team: [], down: [], formation: [], coverage: [], result: [] }
  let layer: Layer = LAYERS[0]
  for (const pair of query.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const key = eq < 0 ? pair : pair.slice(0, eq)
    const raw = eq < 0 ? '' : pair.slice(eq + 1)
    if (key === 'layer') {
      const v = safeDecode(raw)
      if ((LAYERS as readonly string[]).includes(v)) layer = v as Layer
    } else if ((DIMENSIONS as readonly string[]).includes(key) && raw !== '') {
      const values = raw.split(',').map(safeDecode)
      switch (key as (typeof DIMENSIONS)[number]) {
        case 'team': filters.team = values; break
        case 'down': filters.down = values as Down[]; break
        case 'formation': filters.formation = values as Formation[]; break
        case 'coverage': filters.coverage = values as Coverage[]; break
        case 'result': filters.result = values as PassResult[]; break
      }
    }
  }
  return { filters, layer }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** GET JSON con AbortController y plazo. Lanza ante cualquier fallo; los llamadores lo capturan. */
async function fetchJson(url: string, timeoutMs: number, opts: ApiOptions): Promise<unknown> {
  const doFetch: FetchLike = opts.fetchImpl ?? ((u, init) => fetch(u, init))
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('timeout'))
    }, timeoutMs)
  })
  try {
    const work = (async () => {
      const res = await doFetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as unknown
    })()
    work.catch(() => undefined) // evita rechazos sin manejar si gana el plazo
    return await Promise.race([work, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function isFiltersResponse(x: unknown): x is FiltersResponse {
  if (typeof x !== 'object' || x === null) return false
  const teams = (x as { teams?: unknown }).teams
  return Array.isArray(teams) && teams.every((t) => typeof t === 'string')
}

export async function getFilters(opts: ApiOptions = {}): Promise<ApiResult<FiltersResponse>> {
  const fallback = (): ApiResult<FiltersResponse> => ({ data: getMockFilters(), source: 'mock' })
  if (opts.useMock ?? USE_MOCK) return fallback()
  try {
    const json = await fetchJson(FILTERS_ROUTE, opts.timeoutMs ?? FILTERS_TIMEOUT_MS, opts)
    if (!isFiltersResponse(json)) return fallback()
    return { data: { teams: [...json.teams] }, source: 'api' }
  } catch {
    return fallback()
  }
}

export async function getHeatmap(
  f: FilterState,
  layer: Layer,
  opts: ApiOptions = {},
): Promise<ApiResult<HeatmapResponse>> {
  const fallback = (): ApiResult<HeatmapResponse> => ({ data: buildMockResponse(f, layer), source: 'mock' })
  if (opts.useMock ?? USE_MOCK) return fallback()
  try {
    const json = await fetchJson(buildHeatmapUrl(f, layer), opts.timeoutMs ?? HEATMAP_TIMEOUT_MS, opts)
    if (validateHeatmapResponse(json, layer).length > 0) return fallback()
    return { data: json as HeatmapResponse, source: 'api' }
  } catch {
    return fallback()
  }
}
