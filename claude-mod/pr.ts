import type { Span } from './frames'

/** What `gh pr view --json` says of an open PR. */
export type PrView = { id?: unknown; isDraft?: unknown; mergeable?: unknown; mergeStateStatus?: unknown; reviewDecision?: unknown; statusCheckRollup?: unknown }

/** One rollup entry: a CheckRun (name/status/conclusion/startedAt) or a StatusContext (context/state). */
export type Check = { name?: unknown; context?: unknown; status?: unknown; conclusion?: unknown; state?: unknown; startedAt?: unknown; completedAt?: unknown }

/** The branch's open PR as the PR line and the scheduler need it; number 0: none. */
export type PrInfo = {
  number: number
  url: string
  baseRef: string
  id: string
  /** The `prStatusOf` word; '' while GitHub has not worked it out. */
  status: string
  /** Mergeable CONFLICTING or merge state DIRTY. */
  isConflict: boolean
  /** Failed check names: latest run per name, unique, in rollup order. */
  failed: string[]
  /** Some (latest) check has not completed. */
  isRunning: boolean
  /** GitHub has not worked out `mergeable` yet. */
  isUnknown: boolean
  /** Unresolved review threads; 0 when unknown. */
  threads: number
}

export const NO_PR_INFO: PrInfo = { number: 0, url: '', baseRef: '', id: '', status: '', isConflict: false, failed: [], isRunning: false, isUnknown: false, threads: 0 }

// Theme keys, not fixed colors (see statusline.ts).
const DIM = 'inactive'
const LINE = 'subtle'
const WARN = 'warning'
const ALARM = 'error'
const PR_COLORS: Record<string, string> = { draft: DIM, conflicts: ALARM, failing: ALARM, changes: WARN, behind: WARN, checks: WARN, review: WARN, blocked: WARN, ready: 'success' }

const FAILED = ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']

/** The ticks and waits of the PR lookup, in ms. */
export const PR_TICK_MS = 5_000
export const PR_UNKNOWN_MS = 5_000
export const PR_UNKNOWN_TRIES = 3
export const PR_BUSY_MS = 15_000
export const PR_ACT_MS = 60_000
export const PR_CALM_MS = 120_000
export const PR_NONE_MS = 300_000

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

const isRunningCheck = (check: Check): boolean =>
  (check.status !== undefined && check.status !== 'COMPLETED') || check.state === 'PENDING' || check.state === 'EXPECTED'

/** The PR's checks: one failed, some still running, or all done well (or none). */
function checksOf(rollup: unknown): 'failed' | 'running' | 'passed' {
  const checks = latestChecksOf(rollup)
  // A check run has a status and a conclusion; an old-style status has a state.
  if (checks.some(isFailed)) return 'failed'
  if (checks.some(isRunningCheck)) return 'running'
  return 'passed'
}

/** An open PR's state in one word, the worst first; '' while GitHub has not worked it out. */
export function prStatusOf(view: PrView): string {
  const state = view.mergeStateStatus
  const checks = checksOf(view.statusCheckRollup)
  if (view.isDraft === true) return 'draft'
  if (view.mergeable === 'CONFLICTING' || state === 'DIRTY') return 'conflicts'
  if (checks === 'failed') return 'failing'
  if (view.reviewDecision === 'CHANGES_REQUESTED') return 'changes'
  if (state === 'BEHIND') return 'behind'
  // GitHub counts running checks as not passing (UNSTABLE), and running required checks block (BLOCKED).
  if (checks === 'running') return 'checks'
  if (state === 'BLOCKED') return view.reviewDecision === 'REVIEW_REQUIRED' ? 'review' : 'blocked'
  if (state === 'CLEAN' || state === 'HAS_HOOKS' || state === 'UNSTABLE') return 'ready'
  // GitHub works out the merge state only when asked: until then, the review still tells something.
  return view.reviewDecision === 'REVIEW_REQUIRED' ? 'review' : ''
}

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
    status: prStatusOf(view),
    isConflict: view.mergeable === 'CONFLICTING' || view.mergeStateStatus === 'DIRTY',
    failed: failedChecksOf(view.statusCheckRollup),
    isRunning: checks.some(isRunningCheck),
    isUnknown: view.mergeable === 'UNKNOWN',
    threads,
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

/** The PR line, `#12078: conflicts · failing: lint, test · 💬 4`: the number a link, then the state and what needs the person, worst first. */
export function prLineOf(pr: PrInfo): Span[] {
  if (pr.number <= 0 || !pr.url) return []
  const parts: Span[] = []
  // Conflicts and failing checks are said by the parts below.
  if (pr.status && pr.status !== 'conflicts' && pr.status !== 'failing') parts.push({ text: pr.status, color: PR_COLORS[pr.status] ?? DIM })
  if (pr.isConflict) parts.push({ text: 'conflicts', color: ALARM })
  if (pr.failed.length > 0) parts.push({ text: `failing: ${namesOf(pr.failed)}`, color: ALARM })
  if (pr.threads > 0) parts.push({ text: `💬 ${pr.threads}`, color: WARN })
  const number: Span = { text: `#${pr.number}`, color: 'suggestion', href: pr.url }
  if (parts.length === 0) return [number]
  return [number, { text: ': ', color: DIM }, ...parts.flatMap((part, i): Span[] => (i === 0 ? [part] : [{ text: ' · ', color: LINE }, part]))]
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
  if (pr.isRunning || sinceActMs < PR_ACT_MS) return PR_BUSY_MS
  return PR_CALM_MS
}

/** What is new for the person on the same PR, `PR #7: failing: lint · 💬 3`; undefined when nothing is. */
export function attentionToastOf(was: PrInfo, now: PrInfo): string | undefined {
  if (now.number === 0 || was.number !== now.number) return undefined
  const items: string[] = []
  if (now.isConflict && !was.isConflict) items.push('conflicts')
  const fresh = now.failed.filter(name => !was.failed.includes(name))
  if (fresh.length > 0) items.push(`failing: ${namesOf(fresh)}`)
  if (now.threads > was.threads) items.push(`💬 ${now.threads}`)
  return items.length > 0 ? `PR #${now.number}: ${items.join(' · ')}` : undefined
}
