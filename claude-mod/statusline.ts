import { hexOf } from './frames'
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
const levelOf = (percent: number): string => hexOf(percent < 50 ? 244 : percent < 80 ? 220 : 203)
const DIM = hexOf(244)
/** Session cost, in USD, above which the cost stands out in yellow; grey up to it. */
const COST_HIGH = 100

const slugOf = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** `feat-x`, `x` and `worktree-x` all name the branch `feat/x`: one ends with the other at a word break. */
export function isSameName(folder: string, branch: string): boolean {
  const [a, b] = [slugOf(folder), slugOf(branch)]
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length > 0 && (long === short || long.endsWith(`-${short}`))
}

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

/** The status line as coloured parts: account | model [effort] | project | branch | 7d … | 5h … | $cost | ctx N%. */
export function statusOf(parts: StatusParts): Span[] {
  const { account, model, effort, project, branch, rateLimits, windows, limitsAt, costUsd, contextPercent, hotAt, now } = parts
  const limits = windows.flatMap((kind): Span[][] => {
    const limit = rateLimits.find(each => each.kind === kind)
    if (!limit || !Number.isFinite(limit.percentUsed) || limit.percentUsed < limitsAt) return []
    const percent = Math.round(limit.percentUsed)
    const left = leftOf(limit.resetsAt, now)
    const meter: Span = { text: meterOf({ kind, percent }), color: levelOf(percent) }
    return [left ? [meter, { text: ` (${left})`, color: DIM }] : [meter]]
  })
  // A worktree folder named like its branch shows once, as the branch.
  const isProjectShown = project && !(branch && isSameName(project, branch))
  const groups: (Span[] | undefined)[] = [
    account ? [{ text: account, color: DIM }] : undefined,
    model ? [{ text: modelNameOf(model), color: hexOf(208) }, ...(effort ? [{ text: ` [${effort}]`, color: DIM }] : [])] : undefined,
    isProjectShown ? [{ text: project, color: hexOf(117) }] : undefined,
    branch ? [{ text: branch, color: hexOf(141) }] : undefined,
    ...limits,
    costUsd !== undefined && Number.isFinite(costUsd) ? [{ text: `$${costUsd.toFixed(2)}`, color: costUsd > COST_HIGH ? hexOf(220) : DIM }] : undefined,
    contextPercent !== undefined && Number.isFinite(contextPercent) ? [{ text: `ctx ${Math.round(contextPercent)}%`, color: contextPercent >= hotAt ? hexOf(203) : DIM }] : undefined,
  ]
  return groups
    .filter((group): group is Span[] => group !== undefined)
    .flatMap((group, i) => (i === 0 ? group : [{ text: ' | ', color: DIM }, ...group]))
}

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
