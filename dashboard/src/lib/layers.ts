import type { Layer } from '../types'

export const LAYERS: readonly Layer[] = ['targets', 'routes', 'pocket_pressure', 'separation']

export const LAYER_INFO: Record<Layer, { name: string; metricLabel: string }> = {
  targets: { name: 'Zonas de Recepción', metricLabel: 'Yardas promedio' },
  routes: { name: 'Rutas de Receptores', metricLabel: 'Yardas por ruta' },
  pocket_pressure: { name: 'Presión al QB', metricLabel: 'EPA promedio' },
  separation: { name: 'Separación Receptor-Defensor', metricLabel: 'Separación promedio (yd)' },
}
