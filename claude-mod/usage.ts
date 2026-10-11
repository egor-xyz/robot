import { DEFAULT_COLOR, cellsOf, hexOf } from './frames'
import type { Frame, Span } from './frames'

export type Limit = { kind: string; percent: number }

/** Cells the gauge takes: ' ' + label(2) + ' ' + bar(5) + ' ' + percent(4). */
export const GAUGE_CELLS = 14

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

/** A 14-cell meter: label, five-cell bar, percent. */
export function gaugeOf({ kind, percent }: Limit): Span[] {
  const p = Math.max(0, Math.min(100, percent))
  const filled = p === 0 ? 0 : Math.min(BAR_CELLS, Math.ceil(p / 20))
  const barColor = hexOf(p < 50 ? 114 : p < 80 ? 220 : 203)
  const spans: Span[] = [
    { text: ` ${labelOf(kind)} `, color: DEFAULT_COLOR },
    { text: '━'.repeat(filled), color: barColor },
    { text: '─'.repeat(BAR_CELLS - filled), color: hexOf(240) },
    { text: ` ${`${p}%`.padStart(4)}`, color: DEFAULT_COLOR },
  ]
  return spans.filter(span => span.text.length > 0)
}

const padOf = (cells: number): Span[] => (cells > 0 ? [{ text: ' '.repeat(cells), color: DEFAULT_COLOR }] : [])

/** Fits row 0 to `layout` cells, then appends the gauge. Other rows are untouched. */
export function withGauge(frame: Frame, layout: number, gauge: Span[]): Frame {
  const row: Span[] = []
  let cells = 0
  for (const span of frame[0] ?? []) {
    let text = ''
    for (const char of span.text) {
      const width = cellsOf(char)
      if (cells + width > layout) {
        // A 2-cell emoji that would cross the edge becomes one space.
        if (cells < layout) text += ' '
        cells = layout
        break
      }
      text += char
      cells += width
    }
    if (text.length > 0) row.push({ text, color: span.color })
    if (cells >= layout) break
  }
  return [[...row, ...padOf(layout - cells), ...gauge], ...frame.slice(1)]
}
