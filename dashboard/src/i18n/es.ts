export const es = {
  appTitle: 'Mapa de Calor NFL',
  appSubtitle: 'Análisis táctico de pases, Big Data Bowl',

  mockBadge: 'Datos simulados',
  noData: 'Sin datos',
  notAvailable: 'N/D',
  retry: 'Reintentar',
  loading: 'Cargando…',
  noTopPlayers: 'Sin jugadores destacados',

  errors: {
    layerLoad: 'No se pudo cargar la capa seleccionada. Se conserva la capa anterior.',
    dataUpdate: 'No se pudieron actualizar los datos.',
    dataLoad: 'No se pudieron cargar los datos.',
    recommendationUnavailable: 'Recomendación no disponible',
    summaryUnavailable: 'Resumen no disponible',
  },

  filters: {
    title: 'Filtros',
    team: 'Equipo',
    down: 'Down',
    formation: 'Formación',
    coverage: 'Cobertura Defensiva',
    result: 'Resultado del Pase',
    reset: 'Restablecer',
    fallbackNotice: 'Se usan opciones de respaldo para el filtro Equipo.',
  },

  layers: {
    title: 'Capas',
    legend: 'Intensidad',
    legendMin: '0',
    legendMax: '1',
  },

  field: {
    alt: 'Campo de fútbol americano con mapa de calor',
    attackDirection: 'Dirección de ataque',
  },

  tooltip: {
    plays: 'Jugadas',
    success: 'Éxito',
  },

  kpi: {
    total_plays: { label: 'Jugadas totales', unit: 'jugadas' },
    avg_yards: { label: 'Yardas promedio', unit: 'yardas' },
    completion_pct: { label: 'Pases completos', unit: '%' },
    sack_rate: { label: 'Tasa de capturas', unit: '%' },
    avg_time_to_throw: { label: 'Tiempo para lanzar', unit: 'segundos' },
  },

  chart: {
    title: 'Yardas promedio por down',
    xAxis: 'Down',
    yAxis: 'Yardas promedio',
  },

  perspectives: {
    title: 'Perspectiva',
    coach: 'Coach',
    scout: 'Scout',
    broadcaster: 'Broadcaster',
  },

  scout: {
    name: 'Nombre',
    position: 'Posición',
    metricLabel: 'Métrica',
    metricValue: 'Valor',
  },

  coach: {
    title: 'Recomendación táctica',
  },

  broadcaster: {
    title: 'Resumen ejecutivo',
  },

  insights: {
    completionLow: 'La efectividad de pase es baja: prioriza rutas cortas y de rápida liberación.',
    completionHigh: 'La efectividad de pase es alta: arriesga más con rutas profundas.',
    completionMid: 'La efectividad de pase es estable: mantén el balance entre pase corto y profundo.',
    sackHigh: 'La tasa de capturas es alta: refuerza la protección o usa pases rápidos.',
    sackLow: 'La protección responde bien: hay margen para desarrollar rutas más largas.',
    timeHigh: 'El tiempo para lanzar es largo: reduce las lecturas del mariscal.',
    timeLow: 'El tiempo para lanzar es corto: el ataque libera el balón con rapidez.',
    coverage: 'Con {value}, ajusta los patrones de ruta según la cobertura.',
    down: 'En {value} down, adapta la distancia de las rutas.',
    broadcast:
      'Se analizan {plays} jugadas con {yards} yardas promedio y {pct} % de pases completos.',
  },
} as const
