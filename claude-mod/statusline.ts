import { cellsOf } from './frames'
import type { Span } from './frames'
import { meterOf } from './usage'

export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

/** What the robot's status line under the prompt reads; a missing part is left out. */
export type StatusParts = {
  account?: string
  model?: string
  effort?: string
  project?: string
  branch?: string
  rateLimits: readonly RateLimit[]
  /** Which windows to show, in order. */
  windows: readonly string[]
  /** A window shows from this % used. */
  limitsAt: number
  costUsd?: number
  contextPercent?: number
  /** The robot's fire level (% context): ctx turns red there, grey below it. */
  hotAt: number
  now: number
}

const HOUR = 3_600_000

/** Green under half, yellow under 80%, red from there: the same steps for limits and context. */
// Theme keys, not fixed colors: Claude Code paints them for the person's theme (dark, light, color-blind, custom).
// `inactive` is the grey Claude Code uses for its own hint text; `subtle` is darker, kept for the separators.
const DIM = 'inactive'
const LINE = 'subtle'
const WARN = 'warning'
const ALARM = 'error'
const levelOf = (percent: number): string => (percent < 50 ? DIM : percent < 80 ? WARN : ALARM)
/** Session cost, in USD, above which the cost stands out in yellow; grey up to it. */
const COST_HIGH = 100

const slugOf = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** `feat-x`, `x` and `worktree-x` all name the branch `feat/x`: one ends with the other at a word break. */
export function isSameName(folder: string, branch: string): boolean {
  const [a, b] = [slugOf(folder), slugOf(branch)]
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length > 0 && (long === short || long.endsWith(`-${short}`))
}

/** Each model family keeps its own color: the theme's claude (Opus), suggestion (Sonnet), success (Haiku) and planMode (Fable) colors; any other grey. */
const MODEL_COLORS: [string, string][] = [['opus', 'claude'], ['sonnet', 'suggestion'], ['haiku', 'success'], ['fable', 'planMode']]
export const modelColorOf = (model: string): string =>
  MODEL_COLORS.find(([family]) => model.toLowerCase().includes(family))?.[1] ?? DIM

/** Effort stays grey up to medium, then warms up: high and xhigh warning, max error. */
const EFFORT_COLORS: Record<string, string> = { high: WARN, xhigh: WARN, max: ALARM }
export const effortColorOf = (effort: string): string => EFFORT_COLORS[effort] ?? DIM

/** `claude-opus-5-5` as the person reads it, `Opus 5.5`; any other name as it is. */
export function modelNameOf(model: string): string {
  const parts = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(model)
  if (!parts) return model
  const [, family = '', major, minor] = parts
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}.${minor}`
}

/** Time left until `resetsAt`, coarse: `2d`, `4h`, `35m`. */
export function leftOf(resetsAt: string | undefined, now: number): string | undefined {
  const at = resetsAt ? Date.parse(resetsAt) : Number.NaN
  if (!Number.isFinite(at)) return undefined
  const left = Math.max(0, at - now)
  if (left >= 24 * HOUR) return `${Math.round(left / (24 * HOUR))}d`
  if (left >= HOUR) return `${Math.round(left / HOUR)}h`
  return `${Math.max(1, Math.round(left / 60_000))}m`
}

/** One part of the status line; on a narrow screen the lowest rank goes first. */
export type StatusGroup = { rank: number; spans: Span[] }

// Who stays longest on a narrow screen: ctx, then the model, the limits, the branch, cost, project, account.
const RANK = { account: 1, project: 2, cost: 3, branch: 4, sevenDay: 5, fiveHour: 6, model: 7, ctx: 8 }
const SEPARATOR: Span = { text: ' | ', color: LINE }

/** The status line's parts in order: account | model [effort] | project | branch | 7d … | 5h … | $cost | ctx N%. */
export function groupsOf(parts: StatusParts): StatusGroup[] {
  const { account, model, effort, project, branch, rateLimits, windows, limitsAt, costUsd, contextPercent, hotAt, now } = parts
  const limits = windows.flatMap((kind): StatusGroup[] => {
    const limit = rateLimits.find(each => each.kind === kind)
    if (!limit || !Number.isFinite(limit.percentUsed) || limit.percentUsed < limitsAt) return []
    const percent = Math.round(limit.percentUsed)
    const left = leftOf(limit.resetsAt, now)
    const meter: Span = { text: meterOf({ kind, percent }), color: levelOf(percent) }
    return [{ rank: kind === 'five_hour' ? RANK.fiveHour : RANK.sevenDay, spans: left ? [meter, { text: ` (${left})`, color: DIM }] : [meter] }]
  })
  // A worktree folder named like its branch shows once, as the branch.
  const isProjectShown = project && !(branch && isSameName(project, branch))
  const groups: (StatusGroup | undefined)[] = [
    account ? { rank: RANK.account, spans: [{ text: account, color: DIM }] } : undefined,
    model ? { rank: RANK.model, spans: [{ text: modelNameOf(model), color: modelColorOf(model) }, ...(effort ? [{ text: ` [${effort}]`, color: effortColorOf(effort) }] : [])] } : undefined,
    isProjectShown ? { rank: RANK.project, spans: [{ text: project, color: 'planMode' }] } : undefined,
    branch ? { rank: RANK.branch, spans: [{ text: branch, color: 'ide' }] } : undefined,
    ...limits,
    costUsd !== undefined && Number.isFinite(costUsd) ? { rank: RANK.cost, spans: [{ text: `$${costUsd.toFixed(2)}`, color: costUsd > COST_HIGH ? WARN : DIM }] } : undefined,
    contextPercent !== undefined && Number.isFinite(contextPercent) ? { rank: RANK.ctx, spans: [{ text: `ctx ${Math.round(contextPercent)}%`, color: contextPercent >= hotAt ? ALARM : DIM }] } : undefined,
  ]
  return groups.filter((group): group is StatusGroup => group !== undefined)
}

const joined = (groups: readonly StatusGroup[]): Span[] => groups.flatMap((group, i) => (i === 0 ? group.spans : [SEPARATOR, ...group.spans]))

/** The parts that fit in `columns` cells, joined by ` | `: the lowest-ranked parts drop out first, and a last part too wide is cut with `…`. */
export function fitStatus(groups: readonly StatusGroup[], columns: number): Span[] {
  let kept = [...groups]
  while (kept.length > 1 && cellsOf(textOfStatus(joined(kept))) > columns) {
    const lowest = kept.reduce((low, group) => (group.rank < low.rank ? group : low))
    kept = kept.filter(group => group !== lowest)
  }
  const spans = joined(kept)
  if (cellsOf(textOfStatus(spans)) <= columns) return spans
  // One part alone is still too wide: cut it, cell by cell.
  let room = Math.max(0, columns - 1)
  const cut: Span[] = []
  for (const span of spans) {
    let text = ''
    for (const char of span.text) {
      if (cellsOf(char) > room) break
      text += char
      room -= cellsOf(char)
    }
    if (text) cut.push({ ...span, text })
    if (text !== span.text) break
  }
  return [...cut, { text: '…', color: DIM }]
}

/** The status line as coloured parts, cut to `columns` cells when given. */
export const statusOf = (parts: StatusParts, columns = Number.POSITIVE_INFINITY): Span[] => fitStatus(groupsOf(parts), columns)

/** The colours a waving branch name runs through: a loop from its own blue to pink and back. */
const WAVE_COLORS = ['ide', 'suggestion', 'merged', 'bashBorder', 'merged', 'suggestion', 'ide', 'planMode']

/** `text` letter by letter, coloured as a wave `step` ticks along: each step moves the colours one letter right. */
export const waveOf = (text: string, step: number): Span[] =>
  [...text].map((char, i) => ({ text: char, color: WAVE_COLORS[(((i - step) % WAVE_COLORS.length) + WAVE_COLORS.length) % WAVE_COLORS.length] ?? DIM }))

/** The groups with the branch drawn as a wave `step` ticks along. */
export const wavedOf = (groups: readonly StatusGroup[], step: number): StatusGroup[] =>
  groups.map(group => (group.rank === RANK.branch ? { ...group, spans: waveOf(textOfStatus(group.spans), step) } : group))

/** The line's text, colours left out. */
export const textOfStatus = (spans: readonly Span[]): string => spans.map(span => span.text).join('')


/** The `oauthAccount` block of `.claude.json`, as far as the account name needs it. */
export type OauthAccount = { organizationName?: unknown; organizationType?: unknown; displayName?: unknown; emailAddress?: unknown }

/** The account as the person knows it: `TegoAI Team` (organisation and plan tier), else their name, else their email's local part. */
export function accountNameOf(account: OauthAccount | undefined): string | undefined {
  const text = (value: unknown): string => (typeof value === 'string' ? value : '')
  const type = text(account?.organizationType).replace(/^claude_/, '').toLowerCase()
  const tier = type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : ''
  const organization = text(account?.organizationName)
  if (organization) return tier ? `${organization} ${tier}` : organization
  return text(account?.displayName) || text(account?.emailAddress).split('@')[0] || undefined
}
