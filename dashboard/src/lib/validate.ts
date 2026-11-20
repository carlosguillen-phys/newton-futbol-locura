import type { Layer, MockFile } from '../types'
import { LAYERS } from './layers'

export interface ContractError {
  /** p. ej. "grid[17] (capa routes)" */
  path: string
  message: string
}

const META_KEYS = [
  'total_plays',
  'avg_yards',
  'completion_pct',
  'sack_rate',
  'avg_time_to_throw',
] as const
const POSITIONS = ['QB', 'WR', 'TE', 'RB', 'CB', 'S'] as const
const EXPECTED_CELLS = 240
const MIN_PLAYERS = 10
const MAX_PLAYERS = 50

const round2 = (n: number): number => Math.round(n * 100) / 100

const EXPECTED_XS: number[] = Array.from({ length: 24 }, (_, i) => i * 5)
const EXPECTED_YS: number[] = Array.from({ length: 10 }, (_, k) => round2(k * 5.33))
const cellKey = (x: number, y: number): string => `${x}|${round2(y)}`
const EXPECTED_KEYS: ReadonlySet<string> = new Set(
  EXPECTED_XS.flatMap((x) => EXPECTED_YS.map((y) => cellKey(x, y))),
)

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Valida una respuesta de heatmap. No modifica la entrada. */
export function validateHeatmapResponse(x: unknown, layerLabel?: Layer): ContractError[] {
  const errors: ContractError[] = []
  const suffix = layerLabel ? ` (capa ${layerLabel})` : ''
  const err = (path: string, message: string): void => {
    errors.push({ path: `${path}${suffix}`, message })
  }

  if (!isObj(x)) {
    err('response', 'la respuesta no es un objeto')
    return errors
  }

  // meta
  let totalPlays: number | null = null
  if (!isObj(x.meta)) {
    err('meta', 'meta ausente o no es un objeto')
  } else {
    for (const k of META_KEYS) {
      const v = x.meta[k]
      if (!isNum(v)) err(`meta.${k}`, `${k} ausente o no es un número finito`)
    }
    if (isNum(x.meta.total_plays)) totalPlays = x.meta.total_plays
  }

  // grid
  if (!Array.isArray(x.grid)) {
    err('grid', 'grid ausente o no es un arreglo')
  } else {
    const grid: unknown[] = x.grid
    if (grid.length !== EXPECTED_CELLS) {
      err('grid', `se esperaban ${EXPECTED_CELLS} celdas y hay ${grid.length}`)
    }
    const seen = new Set<string>()
    let sum = 0
    grid.forEach((c, i) => {
      const p = `grid[${i}]`
      if (!isObj(c)) {
        err(p, 'la celda no es un objeto')
        return
      }
      let coordsOk = true
      for (const k of ['x_bin', 'y_bin', 'avg_epa_or_yards'] as const) {
        if (!isNum(c[k])) {
          err(`${p}.${k}`, `${k} ausente o no es un número finito`)
          if (k !== 'avg_epa_or_yards') coordsOk = false
        }
      }
      if (coordsOk) {
        const key = cellKey(c.x_bin as number, c.y_bin as number)
        if (!EXPECTED_KEYS.has(key)) {
          err(p, `celda fuera de la rejilla esperada (x_bin=${String(c.x_bin)}, y_bin=${String(c.y_bin)})`)
        } else if (seen.has(key)) {
          err(p, `celda duplicada (x_bin=${String(c.x_bin)}, y_bin=${String(c.y_bin)})`)
        }
        seen.add(key)
      }
      for (const k of ['intensity', 'success_rate'] as const) {
        const v = c[k]
        if (!isNum(v)) err(`${p}.${k}`, `${k} ausente o no es un número finito`)
        else if (v < 0 || v > 1) err(`${p}.${k}`, `${k} fuera de [0,1]: ${v}`)
      }
      const pc = c.plays_count
      if (!isNum(pc)) err(`${p}.plays_count`, 'plays_count ausente o no es un número finito')
      else if (!Number.isInteger(pc) || pc < 0) {
        err(`${p}.plays_count`, `plays_count debe ser un entero >= 0: ${pc}`)
      } else sum += pc
    })
    if (totalPlays !== null && sum > totalPlays) {
      err('grid', `la suma de plays_count (${sum}) excede meta.total_plays (${totalPlays})`)
    }
  }

  // top_players
  if (!Array.isArray(x.top_players)) {
    err('top_players', 'top_players ausente o no es un arreglo')
  } else {
    const players: unknown[] = x.top_players
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
      err('top_players', `se esperaban entre ${MIN_PLAYERS} y ${MAX_PLAYERS} jugadores y hay ${players.length}`)
    }
    const found = new Set<string>()
    players.forEach((pl, i) => {
      const p = `top_players[${i}]`
      if (!isObj(pl)) {
        err(p, 'el jugador no es un objeto')
        return
      }
      if (!isNum(pl.nflId)) err(`${p}.nflId`, 'nflId ausente o no es un número')
      if (typeof pl.name !== 'string') err(`${p}.name`, 'name ausente o no es texto')
      if (typeof pl.metric_label !== 'string') err(`${p}.metric_label`, 'metric_label ausente o no es texto')
      if (!isNum(pl.metric_value)) err(`${p}.metric_value`, 'metric_value ausente o no es un número finito')
      if (typeof pl.position !== 'string' || !(POSITIONS as readonly string[]).includes(pl.position)) {
        err(`${p}.position`, `position inválida: ${String(pl.position)}`)
      } else found.add(pl.position)
    })
    const missing = POSITIONS.filter((pos) => !found.has(pos))
    if (missing.length > 0) {
      err('top_players', `faltan posiciones: ${missing.join(', ')}`)
    }
  }

  return errors
}

/** Valida las cuatro capas del archivo mock y que sus intensidades difieran. */
export function validateMockFile(m: MockFile): ContractError[] {
  const errors: ContractError[] = []
  const layers: Partial<Record<Layer, unknown>> = isObj(m) && isObj(m.layers) ? m.layers : {}
  if (!isObj(m) || !isObj(m.layers)) {
    errors.push({ path: 'layers', message: 'layers ausente o no es un objeto' })
  }
  if (isObj(m) && (!isObj(m.filters) || !Array.isArray(m.filters.teams))) {
    errors.push({ path: 'filters.teams', message: 'filters.teams ausente o no es un arreglo' })
  }

  const intensities = new Map<Layer, string>()
  for (const layer of LAYERS) {
    const resp = layers[layer]
    if (resp === undefined) {
      errors.push({ path: `layers.${layer}`, message: `falta la capa ${layer}` })
      continue
    }
    errors.push(...validateHeatmapResponse(resp, layer))
    if (isObj(resp) && Array.isArray(resp.grid)) {
      intensities.set(
        layer,
        JSON.stringify(
          (resp.grid as unknown[]).map((c) => (isObj(c) ? c.intensity : null)),
        ),
      )
    }
  }

  const names = [...intensities.keys()]
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (intensities.get(names[i]) === intensities.get(names[j])) {
        errors.push({
          path: `layers.${names[j]}`,
          message: `las intensidades de ${names[j]} son idénticas a las de ${names[i]}`,
        })
      }
    }
  }
  return errors
}
