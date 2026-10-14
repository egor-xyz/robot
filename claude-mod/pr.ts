import { cellsOf } from './frames'
import type { Span } from './frames'
import { fitStatus, textOfStatus } from './statusline'
import type { StatusGroup } from './statusline'

/** What `gh pr view --json` says of an open PR. */
export type PrView = { id?: unknown; autoMergeRequest?: unknown; mergeable?: unknown; mergeStateStatus?: unknown; statusCheckRollup?: unknown }

/** One rollup entry: a CheckRun (name/status/conclusion/startedAt) or a StatusContext (context/state). */
export type Check = { name?: unknown; context?: unknown; status?: unknown; conclusion?: unknown; state?: unknown; startedAt?: unknown; completedAt?: unknown }

/** The branch's open PR as the PR line and the scheduler need it; number 0: none. */
export type PrInfo = {
  number: number
  url: string
  baseRef: string
  id: string
  /** Mergeable CONFLICTING or merge state DIRTY. */
  isConflict: boolean
  /** Failed check names: latest run per name, unique, in rollup order. */
  failed: string[]
  /** Checks (latest run per name) done and not failed, and still running. */
  passed: number
  running: number
  /** GitHub has not worked out `mergeable` yet. */
  isUnknown: boolean
  /** Unresolved review threads; 0 when unknown. */
  threads: number
  /** Auto-merge is on: GitHub merges the PR when it can. */
  isAutoMerge: boolean
}

export const NO_PR_INFO: PrInfo = { number: 0, url: '', baseRef: '', id: '', isConflict: false, failed: [], passed: 0, running: 0, isUnknown: false, threads: 0, isAutoMerge: false }

// Theme keys, not fixed colors (see statusline.ts).
const DIM = 'inactive'
const LINE = 'subtle'
const WARN = 'warning'
const ALARM = 'error'

const FAILED = ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']

/** The ticks and waits of the PR lookup, in ms. */
export const PR_TICK_MS = 5_000
export const PR_UNKNOWN_MS = 5_000
export const PR_UNKNOWN_TRIES = 3
export const PR_BUSY_MS = 15_000
export const PR_ACT_MS = 60_000
export const PR_CALM_MS = 120_000
export const PR_NONE_MS = 300_000

/** True when `gh pr view` says the branch has no PR, as opposed to failing for another reason. */
export const isNoPrOf = (output: string): boolean => /no (open )?pull requests? found/i.test(output)

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '')

/** The check's name: a check run has a `name`, an old-style status a `context`. */
const nameOf = (check: Check): string => textOf(check.name) || textOf(check.context)

/** The rollup with one entry per check name: a re-run replaces the run before it. A check with no name stays as it is. */
export function latestChecksOf(rollup: unknown): Check[] {
  const checks = Array.isArray(rollup) ? (rollup as Check[]) : []
  const timeOf = (check: Check): string => String(check.startedAt ?? check.completedAt ?? '')
  const winners = new Map<string, Check>()
  for (const check of checks) {
    const name = nameOf(check)
    if (!name) continue
    const was = winners.get(name)
    if (!was || timeOf(check) >= timeOf(was)) winners.set(name, check)
  }
  const seen = new Set<string>()
  return checks.filter(check => {
    const name = nameOf(check)
    if (!name) return true
    // The winner stays at the place of the first entry of its name.
    if (seen.has(name)) return false
    seen.add(name)
    return true
  }).map(check => {
    const name = nameOf(check)
    return name ? (winners.get(name) ?? check) : check
  })
}

const isFailed = (check: Check): boolean => FAILED.includes(String(check.conclusion)) || FAILED.includes(String(check.state))

/** The names of the checks that failed, by their latest run. */
export function failedChecksOf(rollup: unknown): string[] {
  const names = latestChecksOf(rollup).filter(isFailed).map(nameOf).filter(Boolean)
  return [...new Set(names)]
}

/** Not done yet: a check run has a status and a conclusion; an old-style status has a state. */
const isRunningCheck = (check: Check): boolean =>
  (check.status !== undefined && check.status !== 'COMPLETED') || check.state === 'PENDING' || check.state === 'EXPECTED'

/** The open PR from `gh pr view --json`, with its unresolved thread count; NO_PR_INFO unless it is open. */
export function prInfoOf(view: PrView & { number?: unknown; url?: unknown; baseRefName?: unknown; state?: unknown }, threads: number): PrInfo {
  const number = typeof view.number === 'number' ? view.number : 0
  if (view.state !== 'OPEN' || number <= 0) return NO_PR_INFO
  const checks = latestChecksOf(view.statusCheckRollup)
  return {
    number,
    url: textOf(view.url),
    baseRef: textOf(view.baseRefName),
    id: textOf(view.id),
    isConflict: view.mergeable === 'CONFLICTING' || view.mergeStateStatus === 'DIRTY',
    failed: failedChecksOf(view.statusCheckRollup),
    passed: checks.filter(check => !isFailed(check) && !isRunningCheck(check)).length,
    running: checks.filter(isRunningCheck).length,
    isUnknown: view.mergeable === 'UNKNOWN',
    threads,
    isAutoMerge: typeof view.autoMergeRequest === 'object' && view.autoMergeRequest !== null,
  }
}

/** The GraphQL query for a PR's review threads, by its node id. */
export const THREADS_QUERY = 'query($id:ID!){node(id:$id){... on PullRequest{reviewThreads(first:100){nodes{isResolved}}}}}'

/** The unresolved threads in the answer of THREADS_QUERY; undefined when the answer has another shape. */
export function unresolvedOf(json: unknown): number | undefined {
  const nodes = (json as { data?: { node?: { reviewThreads?: { nodes?: unknown } } | null } } | null | undefined)?.data?.node?.reviewThreads?.nodes
  if (!Array.isArray(nodes)) return undefined
  return nodes.filter(node => (node as { isResolved?: unknown } | null)?.isResolved === false).length
}

/** The host of the PR's url, for `gh api --hostname`; github.com when the url is no url. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname || 'github.com'
  } catch {
    return 'github.com'
  }
}

/** Up to 3 names as they are, more as a count. */
const namesOf = (failed: readonly string[]): string => (failed.length <= 3 ? failed.join(', ') : `${failed.length} checks`)

/** The PR line, `#7: ✗ lint, test | ◌ 2 | ✓ 5 | conflicts | 💬 4 | auto merge`: the number links to the PR, then the checks, what needs the person, and auto-merge. Nothing to say, no line. */
export function prLineOf(pr: PrInfo): Span[] {
  if (pr.number <= 0 || !pr.url) return []
  const checks: Span[] = [
    ...(pr.failed.length > 0 ? [{ text: `✗ ${namesOf(pr.failed)}`, color: ALARM }] : []),
    ...(pr.running > 0 ? [{ text: `◌ ${pr.running}`, color: WARN }] : []),
    ...(pr.passed > 0 ? [{ text: `✓ ${pr.passed}`, color: 'success' }] : []),
  ]
  // Every part is apart by ` | `, as on the status line.
  const sections: Span[][] = [
    ...checks.map(check => [check]),
    ...(pr.isConflict ? [[{ text: 'conflicts', color: ALARM }]] : []),
    ...(pr.threads > 0 ? [[{ text: `💬 ${pr.threads}`, color: WARN }]] : []),
    ...(pr.isAutoMerge ? [[{ text: 'auto merge', color: 'success' }]] : []),
  ]
  if (sections.length === 0) return []
  const joined = sections.flatMap((section, i): Span[] => (i === 0 ? section : [PR_ROW_SEPARATOR, ...section]))
  return [{ text: `#${pr.number}`, color: 'suggestion', href: pr.url }, { text: ': ', color: DIM }, ...joined]
}

/** Between the PR info and the changed files on their shared line. */
export const PR_ROW_SEPARATOR: Span = { text: ' | ', color: LINE }
/** The changed files show only with at least this much room left after the PR info. */
const CHANGES_MIN = 4

/** The PR info and the changed files on one line, `#7: ✓ 3 | 10 files changed | +550`: the PR info keeps its room, the files get what is left. */
export function prRowOf(pr: readonly Span[], changes: readonly StatusGroup[], columns: number): { pr: Span[]; changed: Span[] } {
  if (pr.length === 0) return { pr: [], changed: fitStatus(changes, columns) }
  const fitted = fitStatus([{ rank: 1, spans: [...pr] }], columns)
  const room = columns - cellsOf(textOfStatus(fitted)) - cellsOf(PR_ROW_SEPARATOR.text)
  return { pr: fitted, changed: room >= CHANGES_MIN ? fitStatus(changes, room) : [] }
}

// A command that moves the PR: a push, a branch change, a `gh pr` act or a re-run. Matches `git` options before the verb.
const PR_ACT = /(?<![\w./-])(?:git(?:\s+(?:-[cC]\s+(?:"[^"]*"|'[^']*'|\S+)|--[\w-]+(?:=\S+)?|-[pP]))*\s+(?:push|checkout|switch|merge|rebase|pull)|gh\s+(?:pr\s+(?:create|merge|ready|close|reopen|edit|review|comment|checkout)|run\s+rerun))(?=[\s;&|)]|$)/

/** Whether a Bash command is likely to change the PR: the lookup runs at once after it. */
export const isPrActOf = (command: string): boolean => PR_ACT.test(command)

/** How long until the next PR lookup. */
export function prDelayOf(at: { pr: PrInfo; unknownTries: number; sinceActMs: number }): number {
  const { pr, unknownTries, sinceActMs } = at
  if (pr.number === 0) return sinceActMs < PR_ACT_MS ? PR_BUSY_MS : PR_NONE_MS
  if (pr.isUnknown && unknownTries < PR_UNKNOWN_TRIES) return PR_UNKNOWN_MS
  // Auto-merge may merge the PR any moment: look often, so the line goes soon after.
  if (pr.running > 0 || sinceActMs < PR_ACT_MS || (pr.isAutoMerge && !pr.isConflict)) return PR_BUSY_MS
  return PR_CALM_MS
}

/** What is new for the person on the same PR, `PR #7: failing: lint · 💬 3 · auto merge off`; undefined when nothing is. */
export function attentionToastOf(was: PrInfo, now: PrInfo): string | undefined {
  if (now.number === 0 || was.number !== now.number) return undefined
  const items: string[] = []
  if (now.isConflict && !was.isConflict) items.push('conflicts')
  const fresh = now.failed.filter(name => !was.failed.includes(name))
  if (fresh.length > 0) items.push(`failing: ${namesOf(fresh)}`)
  if (now.threads > was.threads) items.push(`💬 ${now.threads}`)
  // Auto-merge went off: by GitHub (a push from someone else, for example) or by the person; either way the PR now waits.
  if (was.isAutoMerge && !now.isAutoMerge) items.push('auto merge off')
  return items.length > 0 ? `PR #${now.number}: ${items.join(' · ')}` : undefined
}
