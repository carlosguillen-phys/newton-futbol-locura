import { EMPTY_FILTERS } from '../lib/filters'
import type {
  ApiResult,
  DataSource,
  FilterState,
  FiltersResponse,
  HeatmapResponse,
  Layer,
  Perspective,
} from '../types'

export interface DashboardState {
  filters: FilterState
  /** Capa activa. Solo cambia al recibir SUCCESS. */
  layer: Layer
  /** Capa solicitada por el usuario, pendiente de SUCCESS. */
  pendingLayer: Layer | null
  perspective: Perspective
  /** Últimos datos mostrados. */
  data: HeatmapResponse | null
  source: DataSource
  loading: boolean
  error: string | null
  filterOptions: FiltersResponse | null
  /** Aviso de opciones de respaldo (Req. 7.10). */
  filterNotice: boolean
  requestId: number
}

export type DashboardAction =
  | { type: 'SET_FILTERS'; filters: FilterState }
  | { type: 'RESET_FILTERS' }
  | { type: 'SELECT_LAYER'; layer: Layer }
  | { type: 'SELECT_PERSPECTIVE'; p: Perspective }
  | { type: 'REQUEST'; id: number }
  | { type: 'SUCCESS'; id: number; result: ApiResult<HeatmapResponse>; layer: Layer }
  | { type: 'FAILURE'; id: number; message: string }
  | { type: 'RETRY' }
  | { type: 'SET_FILTER_OPTIONS'; options: FiltersResponse; notice: boolean }

function copyFilters(f: FilterState): FilterState {
  return {
    team: [...f.team],
    down: [...f.down],
    formation: [...f.formation],
    coverage: [...f.coverage],
    result: [...f.result],
  }
}

export const initialDashboardState: DashboardState = {
  filters: copyFilters(EMPTY_FILTERS),
  layer: 'targets',
  pendingLayer: null,
  perspective: 'coach',
  data: null,
  source: 'mock',
  loading: false,
  error: null,
  filterOptions: null,
  filterNotice: false,
  requestId: 0,
}

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_FILTERS':
      return { ...state, filters: copyFilters(action.filters) }
    case 'RESET_FILTERS':
      return { ...state, filters: copyFilters(EMPTY_FILTERS) }
    case 'SELECT_LAYER':
      // La capa activa no cambia hasta SUCCESS (Req. 6.2, 6.7).
      return { ...state, pendingLayer: action.layer }
    case 'SELECT_PERSPECTIVE':
      return { ...state, perspective: action.p }
    case 'REQUEST':
      return { ...state, requestId: action.id, loading: true, error: null }
    case 'SUCCESS':
      if (action.id !== state.requestId) return state
      return {
        ...state,
        layer: action.layer,
        pendingLayer: null,
        data: action.result.data,
        source: action.result.source,
        loading: false,
        error: null,
      }
    case 'FAILURE':
      if (action.id !== state.requestId) return state
      return { ...state, pendingLayer: null, loading: false, error: action.message }
    case 'RETRY':
      return { ...state, error: null, loading: true }
    case 'SET_FILTER_OPTIONS':
      return { ...state, filterOptions: action.options, filterNotice: action.notice }
    default:
      return state
  }
}
