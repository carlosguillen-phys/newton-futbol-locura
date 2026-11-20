import { es } from '../i18n/es'
import type { FilterState, Meta } from '../types'

const COACH_MAX = 300
const BROADCAST_MAX = 200

const META_KEYS: (keyof Meta)[] = [
  'total_plays',
  'avg_yards',
  'completion_pct',
  'sack_rate',
  'avg_time_to_throw',
]

function isValidMeta(meta: unknown): meta is Meta {
  if (meta === null || typeof meta !== 'object') return false
  const m = meta as Record<string, unknown>
  return META_KEYS.every((k) => typeof m[k] === 'number' && Number.isFinite(m[k] as number))
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…'
}

/** Recomendación determinista de 1 a 3 frases (máx. 300 caracteres). */
export function coachRecommendation(
  filters: FilterState | null | undefined,
  meta: Meta | null | undefined,
): string | null {
  if (!isValidMeta(meta)) return null
  const t = es.insights
  const sentences: string[] = []

  if (meta.completion_pct < 55) sentences.push(t.completionLow)
  else if (meta.completion_pct >= 68) sentences.push(t.completionHigh)
  else sentences.push(t.completionMid)

  if (meta.sack_rate >= 7) sentences.push(t.sackHigh)
  else if (meta.avg_time_to_throw >= 2.9) sentences.push(t.timeHigh)
  else if (meta.sack_rate < 4) sentences.push(t.sackLow)
  else if (meta.avg_time_to_throw < 2.4) sentences.push(t.timeLow)

  const coverage = filters?.coverage ?? []
  const down = filters?.down ?? []
  if (coverage.length > 0) {
    sentences.push(t.coverage.replace('{value}', coverage.join(', ')))
  } else if (down.length > 0) {
    sentences.push(t.down.replace('{value}', down.join(', ')))
  }

  return clip(sentences.slice(0, 3).join(' '), COACH_MAX)
}

/** Resumen de una sola frase (máx. 200 caracteres). */
export function broadcastSummary(meta: Meta | null | undefined): string | null {
  if (!isValidMeta(meta)) return null
  const text = es.insights.broadcast
    .replace('{plays}', String(Math.round(meta.total_plays)))
    .replace('{yards}', meta.avg_yards.toFixed(1))
    .replace('{pct}', meta.completion_pct.toFixed(1))
  return clip(text, BROADCAST_MAX)
}
