/**
 * Script de verificación de propiedades (sin dependencias).
 * Se ejecuta con `npm run verify`. No se importa desde main.tsx.
 */
import { mulberry32 } from '../mocks/prng'
import {
  COVERAGE_OPTIONS,
  DOWN_OPTIONS,
  FORMATION_OPTIONS,
  RESULT_OPTIONS,
} from '../lib/filters'
import type { FilterState, Layer, Meta } from '../types'

// El proyecto no incluye @types/node; se declara solo lo necesario.
declare const process: {
  env: Record<string, string | undefined>
  exitCode?: number
}

const parsedSeed = Number(process.env.VERIFY_SEED)
export const SEED: number =
  process.env.VERIFY_SEED !== undefined && process.env.VERIFY_SEED !== '' && Number.isFinite(parsedSeed)
    ? parsedSeed
    : 12345

export const MIN_CASES = 100

export type Rng = () => number

const failures: string[] = []
let executed = 0

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) =>
      typeof v === 'number' && !Number.isFinite(v) ? String(v) : v === undefined ? '__undefined__' : v,
    )
  } catch {
    return String(value)
  }
}

/**
 * Ejecuta `fn` sobre `max(n, 100)` casos. Cada caso recibe un generador propio
 * derivado de SEED y del número de caso. `fn` lanza un error si la propiedad falla.
 * Para registrar la entrada, `fn` puede devolver un valor que se mostrará en el fallo
 * (o adjuntarlo con `fail(input, mensaje)`). No hay reducción de contraejemplos.
 */
export function check(n: number, title: string, fn: (rng: Rng, caso: number) => unknown): void {
  const total = Math.max(n, MIN_CASES)
  executed++
  for (let i = 0; i < total; i++) {
    const rng = mulberry32((SEED + Math.imul(i + 1, 0x9e3779b1)) >>> 0)
    try {
      fn(rng, i)
    } catch (e) {
      let detail: string
      if (e instanceof PropertyFailure) {
        detail = `${e.message}\n    entrada: ${safeStringify(e.input)}`
      } else {
        detail = e instanceof Error ? e.message : String(e)
      }
      const msg = `FALLA ${title}\n    semilla: ${SEED}, caso: ${i + 1}/${total}\n    ${detail}`
      failures.push(msg)
      console.error(msg)
      return
    }
  }
  console.log(`OK    ${title} (${total} casos, semilla ${SEED})`)
}

export class PropertyFailure extends Error {
  constructor(
    message: string,
    public readonly input: unknown,
  ) {
    super(message)
  }
}

/** Lanza un fallo de propiedad que incluye la entrada que lo provocó. */
export function fail(input: unknown, message: string): never {
  throw new PropertyFailure(message, input)
}

/** Lanza un fallo con la entrada si `cond` es falsa. */
export function assert(cond: unknown, input: unknown, message: string): asserts cond {
  if (!cond) fail(input, message)
}

/** Imprime el resumen y fija el código de salida distinto de 0 si algo falló. */
export function finish(): void {
  console.log(`\n${executed - failures.length}/${executed} propiedades correctas (semilla ${SEED})`)
  if (failures.length > 0) process.exitCode = 1
}

// ---------- Generadores básicos ----------

export const LAYERS: readonly Layer[] = ['targets', 'routes', 'pocket_pressure', 'separation']
export const TEAM_SAMPLE: readonly string[] = ['KC', 'BUF', 'SF', 'DAL', 'PHI', 'MIA']

export function genInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function genPick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

/** Subconjunto en orden original; con probabilidad ~1/4 vacío y ~1/4 completo. */
export function genSubset<T>(rng: Rng, items: readonly T[]): T[] {
  const r = rng()
  if (r < 0.25) return []
  if (r < 0.5) return [...items]
  return items.filter(() => rng() < 0.5)
}

export function genLayer(rng: Rng): Layer {
  return genPick(rng, LAYERS)
}

export function genFilterState(rng: Rng): FilterState {
  return {
    team: genSubset(rng, TEAM_SAMPLE),
    down: genSubset(rng, DOWN_OPTIONS),
    formation: genSubset(rng, FORMATION_OPTIONS),
    coverage: genSubset(rng, COVERAGE_OPTIONS),
    result: genSubset(rng, RESULT_OPTIONS),
  }
}

export const META_FIELDS: readonly (keyof Meta)[] = [
  'total_plays',
  'avg_yards',
  'completion_pct',
  'sack_rate',
  'avg_time_to_throw',
]

export function genValidMeta(rng: Rng): Meta {
  return {
    total_plays: genInt(rng, 0, 5000),
    avg_yards: Math.round((rng() * 20 - 2) * 100) / 100,
    completion_pct: Math.round(rng() * 10000) / 100,
    sack_rate: Math.round(rng() * 10000) / 100,
    avg_time_to_throw: Math.round((1.5 + rng() * 2.5) * 100) / 100,
  }
}

const INVALID_VALUES: readonly unknown[] = [
  NaN,
  Infinity,
  -Infinity,
  null,
  undefined,
  '3.2',
  -1,
  101,
  {},
]

/** Meta con campos válidos; con probabilidad 1/2 uno o más campos reciben un valor inválido. */
export function genMeta(rng: Rng): Meta {
  const meta: Record<string, unknown> = { ...genValidMeta(rng) }
  if (rng() < 0.5) {
    const count = genInt(rng, 1, META_FIELDS.length)
    for (let i = 0; i < count; i++) {
      meta[genPick(rng, META_FIELDS)] = genPick(rng, INVALID_VALUES)
    }
  }
  return meta as unknown as Meta
}

// ---------- Propiedades ----------
// (las tareas siguientes agregan aquí sus llamadas a `check`)

finish()
