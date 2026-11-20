import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { es } from '../i18n/es'
import { getFilters, getHeatmap, USE_MOCK } from '../services/api'
import { getMockFilters } from '../mocks/mockEngine'
import type { FilterState, Layer, Perspective } from '../types'
import {
  dashboardReducer,
  initialDashboardState,
  type DashboardState,
} from './dashboardReducer'

export interface UseDashboard {
  state: DashboardState
  setFilters: (filters: FilterState) => void
  resetFilters: () => void
  selectLayer: (layer: Layer) => void
  selectPerspective: (p: Perspective) => void
  retry: () => void
}

interface RequestTarget {
  layer: Layer
  /** Cambia en cada reintento o selección para forzar una nueva solicitud. */
  tick: number
}

export function useDashboard(): UseDashboard {
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState)
  const [target, setTarget] = useState<RequestTarget>({ layer: initialDashboardState.layer, tick: 0 })
  const counter = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state

  // Carga inicial de opciones de filtros (Req. 1.9, 7.10).
  useEffect(() => {
    let cancelled = false
    getFilters()
      .then((r) => {
        if (cancelled) return
        dispatch({ type: 'SET_FILTER_OPTIONS', options: r.data, notice: !USE_MOCK && r.source === 'mock' })
      })
      .catch(() => {
        if (cancelled) return
        dispatch({ type: 'SET_FILTER_OPTIONS', options: getMockFilters(), notice: !USE_MOCK })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Solicitud de datos al cambiar filtros, capa solicitada o al reintentar (Req. 6.2, 7.6).
  const { filters } = state
  useEffect(() => {
    const id = ++counter.current
    const layer = target.layer
    dispatch({ type: 'REQUEST', id })
    getHeatmap(filters, layer)
      .then((result) => dispatch({ type: 'SUCCESS', id, result, layer }))
      .catch(() => {
        const s = stateRef.current
        const message =
          s.data === null ? es.errors.dataLoad : layer !== s.layer ? es.errors.layerLoad : es.errors.dataUpdate
        dispatch({ type: 'FAILURE', id, message })
      })
  }, [filters, target])

  const setFilters = useCallback((f: FilterState) => dispatch({ type: 'SET_FILTERS', filters: f }), [])
  const resetFilters = useCallback(() => dispatch({ type: 'RESET_FILTERS' }), [])
  const selectLayer = useCallback((layer: Layer) => {
    dispatch({ type: 'SELECT_LAYER', layer })
    setTarget((t) => ({ layer, tick: t.tick + 1 }))
  }, [])
  const selectPerspective = useCallback((p: Perspective) => dispatch({ type: 'SELECT_PERSPECTIVE', p }), [])
  const retry = useCallback(() => {
    dispatch({ type: 'RETRY' })
    setTarget((t) => ({ ...t, tick: t.tick + 1 }))
  }, [])

  return { state, setFilters, resetFilters, selectLayer, selectPerspective, retry }
}
