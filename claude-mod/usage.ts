import { cellsOf } from './frames'

export type Limit = { kind: string; percent: number }

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '$$' }

const labelOf = (kind: string): string => {
  const label = LABELS[kind] ?? '··'
  return cellsOf(label) === 2 ? label : '??'
}

/** The limit as plain text for the status line under the prompt: label and percent (`7d 23%`). */
export function meterOf({ kind, percent }: Limit): string {
  return `${labelOf(kind)} ${Math.max(0, Math.min(100, percent))}%`
}
