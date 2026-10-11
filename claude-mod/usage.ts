import { cellsOf } from './frames'

export type Limit = { kind: string; percent: number }

const BAR_CELLS = 5
const PREFERRED = ['five_hour', 'seven_day']

/** The rate limit closest to its cap; null when no reading is usable. */
export function tightestLimit(rateLimits: readonly { kind: string; percentUsed: number }[]): Limit | null {
  let best: { kind: string; percentUsed: number } | null = null
  for (const limit of rateLimits) {
    if (!Number.isFinite(limit.percentUsed)) continue
    if (best === null || limit.percentUsed > best.percentUsed) {
      best = limit
    } else if (limit.percentUsed === best.percentUsed) {
      const rank = (kind: string) => {
        const at = PREFERRED.indexOf(kind)
        return at < 0 ? PREFERRED.length : at
      }
      if (rank(limit.kind) < rank(best.kind)) best = limit
    }
  }
  return best === null ? null : { kind: best.kind, percent: Math.round(best.percentUsed) }
}

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '$$' }

const labelOf = (kind: string): string => {
  const label = LABELS[kind] ?? '··'
  return cellsOf(label) === 2 ? label : '??'
}

/** The meter as plain text for the status line under the prompt: label, five-cell bar, percent (`7d ━━─── 23%`). */
export function meterOf({ kind, percent }: Limit): string {
  const p = Math.max(0, Math.min(100, percent))
  const filled = p === 0 ? 0 : Math.min(BAR_CELLS, Math.ceil(p / 20))
  return `${labelOf(kind)} ${'━'.repeat(filled)}${'─'.repeat(BAR_CELLS - filled)} ${p}%`
}
