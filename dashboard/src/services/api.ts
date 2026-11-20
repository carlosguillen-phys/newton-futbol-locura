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

/** Nombre del parámetro en la API para cada dimensión del dashboard. */
const PARAM_NAME: Record<(typeof DIMENSIONS)[number], string> = {
  team: 'team',
  down: 'down',
  formation: 'formation',
  coverage: 'coverage',
  result: 'pass_result',
}

const DOWN_TO_NUM: Record<string, string> = { '1st': '1', '2nd': '2', '3rd': '3', '4th': '4' }
const NUM_TO_DOWN: Record<string, Down> = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th' }

/** Construye `api/heatmap?layer=...&team=A,B...` (relativa, sin filtros vacíos). */
export function buildHeatmapUrl(f: FilterState, layer: Layer): string {
  const parts = [`layer=${encodeURIComponent(layer)}`]
  for (const d of DIMENSIONS) {
    let values = f[d] as string[]
    if (d === 'down') values = values.map((v) => DOWN_TO_NUM[v] ?? v)
    if (values.length > 0) parts.push(`${PARAM_NAME[d]}=${values.map(encodeURIComponent).join(',')}`)
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
    } else if (raw !== '') {
      const values = raw.split(',').map(safeDecode)
      switch (key) {
        case 'team': filters.team = values; break
        case 'down': filters.down = values.map((v) => NUM_TO_DOWN[v] ?? (v as Down)); break
        case 'formation': filters.formation = values as Formation[]; break
        case 'coverage': filters.coverage = values as Coverage[]; break
        case 'pass_result': filters.result = values as PassResult[]; break
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


function normalizeApiHeatmap(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.grid)) return raw

  const xs = Array.from({ length: 24 }, (_, i) => i * 5)
  const ys = Array.from({ length: 10 }, (_, k) => Math.round(k * 5.33 * 100) / 100)
  const cellMap = new Map<string, Record<string, unknown>>()

  for (const item of obj.grid) {
    if (typeof item !== 'object' || item === null) continue
    const c = item as Record<string, unknown>
    const rx = Number(c.x_bin)
    const ry = Number(c.y_bin)
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) continue
    const xi = Math.max(0, Math.min(23, Math.floor(rx / 5)))
    const yi = Math.max(0, Math.min(9, Math.floor((ry + 2.5) / 5.33)))
    const key = `${xs[xi]}|${ys[yi]}`
    const prev = cellMap.get(key)
    const pc = Math.max(0, Math.round(Number(c.plays_count) || 0))
    if (!prev) {
      cellMap.set(key, {
        ...c,
        x_bin: xs[xi],
        y_bin: ys[yi],
        plays_count: pc,
        intensity: Math.max(0, Math.min(1, Number(c.intensity) || 0)),
        success_rate: Math.max(0, Math.min(1, Number(c.success_rate) || 0)),
        avg_epa_or_yards: Number(c.avg_epa_or_yards) || 0,
      })
    } else {
      const prevPc = Number(prev.plays_count) || 0
      const totPc = prevPc + pc
      prev.plays_count = totPc
      prev.intensity = Math.max(Number(prev.intensity) || 0, Math.min(1, Number(c.intensity) || 0))
      if (totPc > 0) {
        prev.success_rate = ((Number(prev.success_rate) || 0) * prevPc + (Number(c.success_rate) || 0) * pc) / totPc
        prev.avg_epa_or_yards = ((Number(prev.avg_epa_or_yards) || 0) * prevPc + (Number(c.avg_epa_or_yards) || 0) * pc) / totPc
      }
    }
  }

  const fullGrid = xs.flatMap((x) =>
    ys.map((y) => {
      const k = `${x}|${y}`
      return (
        cellMap.get(k) ?? {
          x_bin: x,
          y_bin: y,
          intensity: 0,
          plays_count: 0,
          success_rate: 0,
          avg_epa_or_yards: 0,
        }
      )
    }),
  )

  return { ...obj, grid: fullGrid }
}

export async function getHeatmap(
  f: FilterState,
  layer: Layer,
  opts: ApiOptions = {},
): Promise<ApiResult<HeatmapResponse>> {
  const fallback = (): ApiResult<HeatmapResponse> => ({ data: buildMockResponse(f, layer), source: 'mock' })
  if (opts.useMock ?? USE_MOCK) return fallback()
  try {
    const rawJson = await fetchJson(buildHeatmapUrl(f, layer), opts.timeoutMs ?? HEATMAP_TIMEOUT_MS, opts)
    const json = normalizeApiHeatmap(rawJson)
    if (validateHeatmapResponse(json, layer).length > 0) return fallback()
    return { data: json as HeatmapResponse, source: 'api' }
  } catch {
    return fallback()
  }
}
