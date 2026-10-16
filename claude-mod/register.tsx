import type { EngineInterface, Register } from 'claude-code'

import { CELL_WIDTH, COMMAND_COLOR, DEFAULT_COLOR, ROW_HEIGHT, celebrating, chilled, clipped, heated, factory, friendsZone, speech, svgOf, typedSoFar, withFriends } from './frames'
import type { Frame, Span } from './frames'
import { stepFriends } from './friends'
import type { Friend } from './friends'
import { CALM_STATES, CALM_TICK_MS } from './calm'
import { HELP_TEXT, actTextOf, commandOf, isOnOf, toggleDenyTextOf, toggleTextOf } from './command'
import type { ToggleKey } from './command'
import { gitActOf } from './git'
import { ACTS, INITIAL, actOf, randomInt, step } from './robot'
import type { ActName, RobotState } from './robot'
import { isQuestion } from './ask'
import { isCompactingMessage, robotWord } from './spinner'
import { accountNameOf, coldGroupOf, fitStatus, groupsOf, SHIMMER, wavedOf } from './statusline'
import { MAX_AGENT_LINES, agentGroupsOf, agentPaneLinesOf, moreOf, stepTokensOf } from './agents'
import type { AgentRow, StepUsage } from './agents'
import { isColdAt, learnedTtlOf, storedTtlOf, ttlOf } from './cache'
import { MAX_NEW_FILES, STATUS_COLORS, changesGroupsOf, countOf, groupOf, listRowsOf, numstatOf, statusesOf, totalsOf } from './changes'
import type { FileChange } from './changes'
import type { RateLimit } from './statusline'
import { NO_PR_INFO, PR_BUSY_MS, PR_CALM_MS, PR_NONE_MS, PR_TICK_MS, THREADS_QUERY, PR_ROW_SEPARATOR, attentionToastOf, hostOf, isNoPrOf, isPrActOf, prDelayOf, prInfoOf, prLineOf, prRowOf, unresolvedOf } from './pr'
import type { PrInfo, PrView } from './pr'
import { LATEST_URL, UPDATE_CHECK_MS, UPDATE_TOAST_MS, isCheckDueOf, storedUpdateOf, updateToastOf, versionOf } from './update'

const TICK_MS = 250
const ROWS = 4
// The robot body is ten cells wide; keep it whole at the right edge.
const BODY_CELLS = 10
const MIN_TRACK = 12
const HEAT_MS = 2000
// How often the cache's age is checked against its TTL.
const COLD_MS = 5000
// Default context usage (percent) at which the head catches fire; the `hotAt` option overrides it.
const HOT_AT = 25
// An animation that never ends by itself: how the robot is held walking or dancing while hot.
const FOREVER = Number.MAX_SAFE_INTEGER
// Hot pace, in ticks (4 a second; 2 in calm mode, so every wait below takes twice as long): every 30 seconds it stops, waves its arms and talks for TALK ticks;
// the rest of the time it walks for PACE_WALK ticks, then stands still for the rest of PACE.
const TALK_EVERY = 120
const TALK = 32
const PACE = 48
const PACE_WALK = 32
// A git commit or push is celebrated for 3 seconds, at 4 ticks a second (calm mode skips it).
const CELEBRATE_TICKS = 12
// The branch name waves for 3 seconds, at 4 ticks a second (calm mode skips it).
const WAVE_TICKS = 12
// The shimmer module draws its own frames, 90 ms apart: 33 of them fill the same 3 seconds.
const SHIMMER_FRAMES = 33
// How often the running subagents are counted.
const AGENTS_MS = 1000

/** Ticks into the current talk, or -1 outside it. */
const talkAt = (at: number): number => (at % TALK_EVERY < TALK ? at % TALK_EVERY : -1)
/** A hot robot moves every other tick, slower than usual, and not while it stands still; its fire moves every tick. */
const isHotStep = (at: number): boolean => at % 2 === 0 && (talkAt(at) >= 0 || (at % TALK_EVERY - TALK) % PACE < PACE_WALK)
// Letters typed per tick while it talks.
const TYPE_SPEED = 2

/** What the hot robot says: the live context, then /compact in Claude Code's command colour. */
const sayOf = (percent: number): Span[][] => [
  [{ text: `context ${percent}%`, color: DEFAULT_COLOR }],
  [{ text: '/compact', color: COMMAND_COLOR }, { text: ' me!', color: DEFAULT_COLOR }],
]
/** What the frozen robot says now and then, while the prompt cache is cold. */
const COLD_SAY: Span[][] = [
  [{ text: 'b-b-brr…', color: DEFAULT_COLOR }],
  [{ text: 'cache frozen!', color: DEFAULT_COLOR }],
]

// Default rate-limit usage (percent) from which the meter shows; 0 shows it whenever there is a reading.
/** Rate-limit usage, in percent, from which a window shows in the status line: 0 shows it always. */
const LIMITS_AT = 0
/** How often the status line refreshes on its own: time left on the limits, the branch. */
const STATUS_MS = 30_000
const STATUS_MARGIN = 4
// Marks each subagent's line under the status line.
const AGENT_MARK: Span = { text: '↳ ', color: 'inactive' }

/** The organisation the person signed in with, from the config dir's .claude.json; undefined when unknown. */
async function accountOf($: EngineInterface): Promise<string | undefined> {
  try {
    const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (await $.env.get('HOME'))
    const read = await $.fs.read(`${dir}/.claude.json`)
    if (typeof read !== 'string') return undefined
    return accountNameOf(JSON.parse(read)?.oauthAccount)
  } catch {
    return undefined
  }
}
const NEEDS_YOU_SAY: Span[][] = [[{ text: 'need a human', color: COMMAND_COLOR }]]

// Plain $.state calls: older engines refuse $ passed into imported helpers.
const TICK = { plugin: 'robot', key: 'tick' } as const
/** The act `/robot play`, `dice` or `coin` asked for: its id and the value the robot lands on. */
const ACT = { plugin: 'robot', key: 'act' } as const
const CONTEXT_PERCENT = { plugin: 'robot', key: 'contextPercent' } as const
const IS_COMPACTING = { plugin: 'robot', key: 'isCompacting' } as const
const CELEBRATION = { plugin: 'robot', key: 'celebration' } as const
const SUBAGENTS = { plugin: 'robot', key: 'subagents' } as const
const IS_ASKED = { plugin: 'robot', key: 'isAsked' } as const
const STATUS = { plugin: 'robot', key: 'status' } as const
const EFFORT = { plugin: 'robot', key: 'effort' } as const
const BRANCH = { plugin: 'robot', key: 'branch' } as const
const WAVE_AT = { plugin: 'robot', key: 'waveAt' } as const
const AGENT_ROWS = { plugin: 'robot', key: 'agentRows' } as const
const CHANGES = { plugin: 'robot', key: 'changes' } as const
/** ms: the start of the main loop's last model request; 0 or absent: none yet. */
const CACHE_AT = { plugin: 'robot', key: 'cacheAt' } as const
/** ms: the start of any subagent's last model request. */
const AGENT_STEP_AT = { plugin: 'robot', key: 'agentStepAt' } as const
/** ms: the end of the main loop's last model request. */
const CACHE_END_AT = { plugin: 'robot', key: 'cacheEndAt' } as const
/** The prompt size (read + written + fresh tokens) of the main loop's last model request. */
const CACHE_PROMPT = { plugin: 'robot', key: 'cachePrompt' } as const
/** '1h' once the session showed a 1-hour cache; absent: not learned. */
const CACHE_TTL = { plugin: 'robot', key: 'cacheTtl' } as const
/** The context the next request re-reads while the cache is cold; 0: warm. */
const COLD_TOKENS = { plugin: 'robot', key: 'coldTokens' } as const
/** The learned cache TTL and the account it was learned on, kept across sessions in $.store. */
const STORE_TTL = 'learnedCacheTtl'
/** The last update check and the version the person was told about, kept across sessions in $.store. */
const STORE_UPDATE = 'updateCheck'
const CHANGES_QUERY = { plugin: 'robot', key: 'changesQuery' } as const
/** The file the panel previews, with its diff; no path: the panel lists the files. */
const CHANGES_PREVIEW = { plugin: 'robot', key: 'changesPreview' } as const
/** The key of the list mark the panel's focus ring is on: `row-3`, `close-mark`, or none. */
const CHANGES_CURSOR = { plugin: 'robot', key: 'changesCursor' } as const
/** The branch's open PR (`number` 0: none) and the commit its diff starts from (HEAD with none). */
const CHANGES_PR = { plugin: 'robot', key: 'changesPr' } as const
const NO_PR = { number: 0, base: 'HEAD', url: '', files: 0, added: 0, removed: 0 }
/** The branch's open PR for the PR line: its checks, conflicts, open review threads and auto-merge (`number` 0: none). */
const PR = { plugin: 'robot', key: 'pr' } as const
/** The panel lists the files: no file previewed. */
const NO_PREVIEW = { path: '', group: 'local' as const, root: '', diff: '' }
/** The most of a diff the preview draws. */
const MAX_DIFF_CHARS = 60_000
/** The panel that lists the changed files. */
const CHANGES_PANE = 'robot-files'
/** The panel that lists every running subagent. */
const AGENTS_PANE = 'robot-agents'

/** The robot as of the last tick drawn: its state, which tick, and that tick's frame. */
const shown: { state: RobotState; at: number; frame: Frame | undefined } = { state: INITIAL, at: -1, frame: undefined }
/** The id of the last act started. Unset until the first draw of this load, which marks an act left from before a reload as seen, so it does not play again. */
let actSeen: number | undefined
/** True while the robot is in an act; the frame it shows then is the act's, with no fire, ice or bubble. */
const isInAct = (s: RobotState): boolean => ACTS.includes(s.state as ActName)
/** The subagent friends as of the last tick they were stepped, and that tick. */
let friends: Friend[] = []
let friendsAt = -1
let lastFriendId = 0
const nextFriendId = (): number => ++lastFriendId
/** The tick the current compaction was first drawn at, or -1 when nothing compacts. */
let packedFrom = -1
// Picks at random who goes first on this compaction's line: a robot or a WALL-E.
let packedSeed = 0
/** What the status line knows apart from what it reads from the session. */
type StatusFixed = { account?: string; windows: readonly string[]; limitsAt: number; hotAt: number }

/** Rebuilds the robot's status line; the hint line under the prompt draws it. */
async function refreshStatus($: EngineInterface, { account, windows, limitsAt, hotAt }: StatusFixed): Promise<void> {
  try {
    const { value: effort } = await $.state.get(EFFORT)
    const [usage, model, cwd] = await Promise.all([$.session.usage(), $.session.model(), $.session.cwd()])
    const git = await $.process.run(['git', '-C', cwd, 'branch', '--show-current'], { timeoutMs: 5_000 }).catch(() => undefined)
    const branch = git?.exitCode === 0 ? git.stdout.trim() : undefined
    // Commits not pushed yet, against where `git push` sends them; never pushed (or no branch) shows no count.
    const count = branch ? await $.process.run(['git', '-C', cwd, 'rev-list', '--count', '@{push}..HEAD'], { timeoutMs: 5_000 }).catch(() => undefined) : undefined
    const ahead = count?.exitCode === 0 ? Number(count.stdout.trim()) || 0 : 0
    // A new branch waves; the first one a session reads does not.
    const { value: was } = await $.state.get(BRANCH)
    if ((branch ?? '') !== was) {
      await $.state.set(BRANCH, branch ?? '')
      // A new branch: look its PR up at once, and often for a minute.
      prDueAt = 0
      prActAt = Date.now()
      if (was !== undefined && branch) await startWave($)
    }
    await $.state.set(STATUS, groupsOf({
      account,
      model,
      effort,
      project: cwd.split('/').filter(Boolean).at(-1),
      branch,
      ahead,
      rateLimits: usage.rateLimits as readonly RateLimit[],
      windows,
      limitsAt,
      costUsd: usage.cost?.usd,
      contextPercent: usage.context?.percent,
      hotAt,
      now: Date.now(),
    }))
  } catch (error) {
    $.ui.log(`robot: status line unavailable: ${String(error)}`, { to: 'debug' })
  }
}

/** Starts the branch wave at the current tick. */
async function startWave($: EngineInterface): Promise<void> {
  const { value: at = 0 } = await $.state.get(TICK)
  await $.state.set(WAVE_AT, at)
}

/**
 * Changes the subagent rows with `change`, safe against other hooks doing the same at once:
 * several agents start together, and a plain read then write would keep only the last one.
 */
async function updateAgentRows($: EngineInterface, change: (rows: AgentRow[]) => AgentRow[]): Promise<void> {
  for (let tries = 0; tries < 8; tries++) {
    const held = await $.state.get(AGENT_ROWS)
    const rows = held.value ?? []
    const next = change(rows)
    if (next === rows) return
    const { isSet } = await $.state.set(AGENT_ROWS, next, { ifVersion: held.version })
    if (isSet) return
  }
}

type Git = (args: string[]) => ReturnType<EngineInterface['process']['run']>

/** The last PR lookup: the branch it was for, and the PR (number 0: none open). Starts over on a reload. */
let prLookup = { key: '', pr: NO_PR_INFO, threadsAt: 0, unknownTries: 0 }
/** ms: the tick looks the PR up when the time is past this. */
let prDueAt = 0
/** ms of the last push, `gh pr` act or branch change. */
let prActAt = 0
/** The lookup running now, so that two asks for one branch make one call. */
let prFlight: { key: string; promise: Promise<PrRefreshed> } | undefined
/** `cached`: reuse the last lookup of this branch; `due`: look up only when the time is up; `now`: look up. */
type PrMode = 'cached' | 'due' | 'now'
/** The PR as read, the PR before it on this branch, and whether `gh` was asked this time. */
type PrRefreshed = { pr: PrInfo; was: PrInfo; isLooked: boolean }

/** The open PR of the branch, by `gh`, and its unresolved review threads; none when `gh` is missing or not signed in. Writes the PR line's state. */
async function refreshPr($: EngineInterface, mode: PrMode): Promise<PrRefreshed> {
  const cached = (): PrRefreshed => ({ pr: prLookup.pr, was: prLookup.pr, isLooked: false })
  try {
    const cwd = await $.session.cwd()
    const git: Git = args => $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs: 5_000, env: { GIT_OPTIONAL_LOCKS: '0' } })
    const top = await git(['rev-parse', '--show-toplevel'])
    if (top.exitCode !== 0) {
      prDueAt = Date.now() + PR_NONE_MS
      return { pr: NO_PR_INFO, was: NO_PR_INFO, isLooked: false }
    }
    const root = top.stdout.trim()
    const branch = (await git(['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
    const key = `${root}\n${branch}`
    const isSame = prLookup.key === key
    if (isSame && (mode === 'cached' || (mode === 'due' && Date.now() < prDueAt))) return cached()
    if (prFlight?.key === key) return await prFlight.promise.then(found => ({ ...found, isLooked: false }))
    const was = isSame ? prLookup.pr : NO_PR_INFO
    const look = async (): Promise<PrRefreshed> => {
      // A detached HEAD and the default branch have no PR of their own: no call.
      const defaultBranch = (await git(['-C', root, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])).stdout.trim().replace(/^origin\//, '')
      if (branch === 'HEAD' || (defaultBranch && branch === defaultBranch)) {
        prLookup = { key, pr: NO_PR_INFO, threadsAt: 0, unknownTries: 0 }
        prDueAt = Date.now() + PR_NONE_MS
        await writePr($, NO_PR_INFO)
        return { pr: NO_PR_INFO, was, isLooked: true }
      }
      const found = await $.process.run(['gh', 'pr', 'view', '--json', 'id,number,baseRefName,state,url,autoMergeRequest,mergeable,mergeStateStatus,statusCheckRollup'], { cwd: root, timeoutMs: 5_000 }).catch(() => undefined)
      let view: Parameters<typeof prInfoOf>[0] = {}
      let isRead = false
      if (found?.exitCode === 0) {
        try {
          view = JSON.parse(found.stdout) as PrView
          isRead = true
        } catch {
          // Not JSON: a failure, not a PR.
        }
      }
      // Only gh saying there is no PR means none; a timeout, the network or auth keep what we had and retry soon.
      if (!isRead && !isNoPrOf(`${found?.stderr ?? ''}\n${found?.stdout ?? ''}`)) {
        $.ui.log(`robot: gh pr view failed: ${found?.stderr?.trim() || 'no answer'}`, { to: 'debug' })
        prDueAt = Date.now() + PR_BUSY_MS
        return { pr: isSame ? prLookup.pr : NO_PR_INFO, was, isLooked: false }
      }
      const now = Date.now()
      const open = prInfoOf(view, 0)
      const isSamePr = isSame && open.number > 0 && prLookup.pr.number === open.number
      let threads = isSamePr ? prLookup.pr.threads : 0
      let threadsAt = isSamePr ? prLookup.threadsAt : 0
      if (open.number > 0 && open.id && (mode === 'now' || !isSamePr || now - prLookup.threadsAt >= PR_CALM_MS)) {
        const asked = await $.process.run(['gh', 'api', 'graphql', '--hostname', hostOf(open.url), '-f', `query=${THREADS_QUERY}`, '-f', `id=${open.id}`], { cwd: root, timeoutMs: 5_000 }).catch(() => undefined)
        let count: number | undefined
        try {
          count = asked?.exitCode === 0 ? unresolvedOf(JSON.parse(asked.stdout)) : undefined
        } catch {
          // Not JSON: keep the count we had.
        }
        threads = count ?? threads
        threadsAt = now
      }
      const pr = { ...open, threads }
      const unknownTries = pr.isUnknown ? (isSamePr ? prLookup.unknownTries + 1 : 1) : 0
      prLookup = { key, pr, threadsAt, unknownTries }
      prDueAt = now + prDelayOf({ pr, unknownTries, sinceActMs: now - prActAt })
      await writePr($, pr)
      return { pr, was, isLooked: true }
    }
    const promise = look().finally(() => {
      if (prFlight?.promise === promise) prFlight = undefined
    })
    prFlight = { key, promise }
    return await promise
  } catch (error) {
    $.ui.log(`robot: PR unavailable: ${String(error)}`, { to: 'debug' })
    return cached()
  }
}

/** Keeps the PR in $.state for the PR line, written only when it changed. */
async function writePr($: EngineInterface, pr: PrInfo): Promise<void> {
  const { value: was } = await $.state.get(PR)
  if (JSON.stringify(was) !== JSON.stringify(pr)) await $.state.set(PR, pr)
}

/** Looks the PR up without waiting for it; the changed files read again when the PR changed, and the person hears what needs them. */
function pokePr($: EngineInterface, mode: PrMode, isLineOn: boolean): void {
  void refreshPr($, mode).then(async ({ pr, was, isLooked }) => {
    if (!isLooked) return
    if (isLineOn && (pr.number !== was.number || pr.baseRef !== was.baseRef)) await refreshChanges($)
    const said = isLineOn ? attentionToastOf(was, pr) : undefined
    if (said) $.ui.toast(said, { timeoutMs: 8_000 })
  }).catch(error => $.ui.log(`robot: PR unavailable: ${String(error)}`, { to: 'debug' }))
}

/** Where the PR's branch began: the commit its diff starts from; HEAD when none is found. */
async function baseOf(git: Git, root: string, baseRef: string): Promise<string> {
  for (const ref of [`origin/${baseRef}`, baseRef]) {
    const found = await git(['-C', root, 'merge-base', 'HEAD', ref])
    if (found.exitCode === 0 && found.stdout.trim()) return found.stdout.trim()
  }
  return 'HEAD'
}

/**
 * Reads the changed files. Always the changes not committed yet (`local`:
 * against HEAD, and the new files). With a PR open, also what its commits
 * changed (`pr`), and for the line the totals of both together.
 */
async function refreshChanges($: EngineInterface): Promise<void> {
  try {
    const cwd = await $.session.cwd()
    const git: Git = args => $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs: 5_000, env: { GIT_OPTIONAL_LOCKS: '0' } })
    const top = await git(['rev-parse', '--show-toplevel'])
    if (top.exitCode !== 0) return
    const root = top.stdout.trim()
    const pr = (await refreshPr($, 'cached')).pr
    const base = pr.number > 0 ? await baseOf(git, root, pr.baseRef) : 'HEAD'
    const diffOf = async (...range: string[]) => {
      const [counts, letters] = await Promise.all([
        git(['-C', root, 'diff', '--no-renames', '--numstat', ...range]),
        git(['-C', root, 'diff', '--no-renames', '--name-status', ...range]),
      ])
      return { counts: counts.exitCode === 0 ? numstatOf(counts.stdout) : [], letters: statusesOf(letters.exitCode === 0 ? letters.stdout : '') }
    }
    const others = await git(['-C', root, 'ls-files', '--others', '--exclude-standard'])
    const paths = others.exitCode === 0 ? others.stdout.split('\n').filter(Boolean) : []
    // A new file's lines come from a diff against nothing; past MAX_NEW_FILES they are not counted.
    const fresh = await Promise.all(paths.map(async (path, i) => {
      if (i >= MAX_NEW_FILES) return { path, added: 0 }
      const counted = await git(['-C', root, 'diff', '--no-index', '--numstat', '--', '/dev/null', path])
      return { path, added: numstatOf(counted.stdout)[0]?.added ?? 0 }
    }))
    const local = await diffOf('HEAD')
    let changes = groupOf('local', local.counts, local.letters, fresh)
    let prNow = { number: 0, base: 'HEAD', url: '', ...totalsOf(changes) }
    if (base !== 'HEAD') {
      const committed = await diffOf(base, 'HEAD')
      changes = [...changes, ...groupOf('pr', committed.counts, committed.letters)]
      // The line counts the PR as it will be once all is committed: the branch's start to the files on disk.
      const all = await diffOf(base)
      prNow = { number: pr.number, base, url: pr.url, ...totalsOf(groupOf('pr', all.counts, all.letters, fresh)) }
    }
    const { value: was = [] } = await $.state.get(CHANGES)
    if (JSON.stringify(was) !== JSON.stringify(changes)) await $.state.set(CHANGES, changes)
    const { value: wasPr } = await $.state.get(CHANGES_PR)
    if (JSON.stringify(wasPr) !== JSON.stringify(prNow)) await $.state.set(CHANGES_PR, prNow)
  } catch (error) {
    $.ui.log(`robot: changed files unavailable: ${String(error)}`, { to: 'debug' })
  }
}

/** Rows in one part of the files list: well under a Client's 100,000-character tree. */
const LIST_PART = 40

/** Where each part of a `count`-row list starts; one part for an empty list (it holds the Close row). */
const partsOf = (count: number): number[] => Array.from({ length: Math.max(1, Math.ceil(count / LIST_PART)) }, (_, i) => i * LIST_PART)

/** The list row the panel's focus ring mark `key` stands for: `row-3` → 3, `close-mark` → the Close row, else -1. */
function cursorOf(key: string, count: number): number {
  if (key === 'close-mark') return count + 1
  const at = /^row-(\d+)$/.exec(key)
  return at ? Number(at[1]) : -1
}

/** Opens the panel with the changed files; asked for, it has room at any width. */
async function openChanges($: EngineInterface): Promise<void> {
  await refreshChanges($)
  await $.state.set(CHANGES_QUERY, '')
  await $.state.set(CHANGES_PREVIEW, NO_PREVIEW)
  await $.state.set(CHANGES_CURSOR, '')
  const opened = await $.ui.open({ id: CHANGES_PANE, title: 'Changed files', focus: true, closeOnEscape: true })
  if (!opened.isPlaced) $.ui.toast('robot: no room for the changed files panel')
}

/** Opens the panel with every running subagent; asked for, it has room at any width. */
async function openAgents($: EngineInterface): Promise<void> {
  const opened = await $.ui.open({ id: AGENTS_PANE, title: 'Subagents', focus: true, closeOnEscape: true })
  if (!opened.isPlaced) $.ui.toast('robot: no room for the subagents panel')
}

/** Shows a changed file's diff in the panel: not committed, against HEAD; in the PR, its commits' diff; a new file whole, as added. */
async function previewChange($: EngineInterface, path: string, group: FileChange['group']): Promise<void> {
  const { value: pr = NO_PR } = await $.state.get(CHANGES_PR)
  const cwd = await $.session.cwd()
  const git = (args: string[]) => $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs: 5_000, env: { GIT_OPTIONAL_LOCKS: '0' } })
  const top = await git(['rev-parse', '--show-toplevel'])
  const root = top.stdout.trim()
  const tracked = await git(['-C', root, 'diff', '--no-renames', ...(group === 'pr' ? [pr.base, 'HEAD'] : ['HEAD']), '--', path])
  const diff = tracked.stdout.trim() ? tracked.stdout : (await git(['-C', root, 'diff', '--no-index', '--', '/dev/null', path])).stdout
  await $.state.set(CHANGES_PREVIEW, { path, group, root, diff: diff.slice(0, MAX_DIFF_CHARS) })
}

/** Opens a file in the app the system picks for it. */
async function openExternally($: EngineInterface, path: string): Promise<void> {
  const os = (await $.process.run(['uname', '-s'], { timeoutMs: 3_000 }).catch(() => undefined))?.stdout.trim()
  const ran = await $.process.run(os === 'Darwin' ? ['open', '--', path] : ['xdg-open', path], { timeoutMs: 10_000 }).catch(() => undefined)
  if (ran?.exitCode !== 0) $.ui.toast(`robot: could not open ${path}`)
}

/** Keeps the turn's effort level and redraws the status line when it changed. */
async function noteEffort($: EngineInterface, level: string | undefined, isStatusOn: boolean, fixed: StatusFixed): Promise<void> {
  if (!level) return
  const { value: was } = await $.state.get(EFFORT)
  if (level === was) return
  await $.state.set(EFFORT, level)
  if (isStatusOn) await refreshStatus($, fixed)
}

// Every setting's default, as .claude-plugin/plugin.json declares it; "Reset all settings to default" writes these back.
const DEFAULTS: Record<string, boolean | number | string> = {
  robot: true, calm: false, statusLine: true, contextFire: true, hotAt: 25, compactFactory: true, gitCheer: true,
  subagentFriends: true, limitWindows: 'both', limitsAt: 0, needsYou: true, robotSpinner: true, branchWave: true, agentLines: true, changesLine: true, cacheCold: true, cacheTtl: '1h', updateToast: true, resetSettings: false,
}

/** A newer robot on main than the installed one: one toast per version, fetched at most every 6 hours across sessions. Never throws. */
async function checkUpdate($: EngineInterface): Promise<void> {
  try {
    // An update check is non-essential traffic.
    if (await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')) return
    const installed = versionOf(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
    if (!installed) {
      $.ui.log('robot: installed version unknown', { to: 'debug' })
      return
    }
    const memo = storedUpdateOf(await $.store.get(STORE_UPDATE))
    const now = Date.now()
    let latest = memo.latest
    let checkedAt = memo.checkedAt
    if (isCheckDueOf(memo.checkedAt, now)) {
      const res = await $.http.fetch(LATEST_URL)
      const found = res.ok ? versionOf(res.text) : undefined
      if (found) {
        latest = found
        checkedAt = now
      } else {
        $.ui.log(`robot: newest version unavailable: ${res.status}`, { to: 'debug' })
      }
    }
    const said = updateToastOf(installed, latest, memo.told)
    // Stored before the toast: if the write throws there is no toast, and the next check retries.
    if (said) await $.store.set(STORE_UPDATE, { checkedAt, latest, told: latest })
    else if (checkedAt !== memo.checkedAt) await $.store.set(STORE_UPDATE, { ...memo, checkedAt, latest })
    if (said) $.ui.toast(said, { timeoutMs: UPDATE_TOAST_MS })
  } catch (error) {
    $.ui.log(`robot: update check failed: ${String(error)}`, { to: 'debug' })
  }
}

/** The cache has outlived its TTL: keep the context it would re-read in $.state, or 0 once it is warm. */
async function checkCold($: EngineInterface, ttlSetting: unknown): Promise<void> {
  try {
    const { value: at = 0 } = await $.state.get(CACHE_AT)
    const { value: learned } = await $.state.get(CACHE_TTL)
    const cold = isColdAt(at, Date.now(), ttlOf(ttlSetting, learned))
    const tokens = cold ? Math.round((await $.session.usage()).context?.tokens ?? 0) : 0
    const { value: was = 0 } = await $.state.get(COLD_TOKENS)
    // A request may have started while the usage was read: it made the cache warm, so skip the write.
    const { value: nowAt = 0 } = await $.state.get(CACHE_AT)
    if (nowAt !== at) return
    if (tokens === was) return
    await $.state.set(COLD_TOKENS, tokens)
    // A request that started during that write warmed the cache: undo the cold mark.
    const { value: afterAt = 0 } = await $.state.get(CACHE_AT)
    if (afterAt !== at && tokens !== 0) await $.state.set(COLD_TOKENS, 0)
  } catch (error) {
    $.ui.log(`robot: cache state unavailable: ${String(error)}`, { to: 'debug' })
  }
}

/**
 * The main loop sends a request: the cache is warm again. Returns the break before it (ms since the previous main
 * request ended or the last subagent request started; 0 when unknown) and that previous request's prompt size.
 */
async function warmCache($: EngineInterface, now: number): Promise<{ breakMs: number; prevPrompt: number }> {
  const { value: cacheAt = 0 } = await $.state.get(CACHE_AT)
  const { value: endAt = 0 } = await $.state.get(CACHE_END_AT)
  const { value: prevPrompt = 0 } = await $.state.get(CACHE_PROMPT)
  const { value: agentStepAt = 0 } = await $.state.get(AGENT_STEP_AT)
  const { value: coldTokens = 0 } = await $.state.get(COLD_TOKENS)
  await $.state.set(CACHE_AT, now)
  if (coldTokens !== 0) await $.state.set(COLD_TOKENS, 0)
  // An end before the start means the previous request never finished: nothing to learn from.
  return { breakMs: endAt >= cacheAt && cacheAt > 0 ? now - Math.max(endAt, agentStepAt) : 0, prevPrompt }
}

/** A TTL learned in an earlier session on the same account: the account's cache kind does not change per chat. */
async function loadTtl($: EngineInterface): Promise<void> {
  try {
    const { value: learned } = await $.state.get(CACHE_TTL)
    if (learned) return
    const stored = storedTtlOf(await $.store.get(STORE_TTL), (await accountOf($)) ?? null)
    if (stored) await $.state.set(CACHE_TTL, stored)
  } catch (error) {
    $.ui.log(`robot: saved cache TTL unavailable: ${String(error)}`, { to: 'debug' })
  }
}

/** A long break that still read the cache shows the 1-hour kind: remember it. */
async function learnTtl($: EngineInterface, breakMs: number, usage: StepUsage, prevPrompt: number): Promise<void> {
  const learned = learnedTtlOf(breakMs, usage, prevPrompt)
  if (!learned) return
  const { value: was } = await $.state.get(CACHE_TTL)
  if (was !== learned) await $.state.set(CACHE_TTL, learned)
  // Kept for later sessions too; a failed disk write must not stop this session's learning.
  try {
    await $.store.set(STORE_TTL, { ttl: learned, account: (await accountOf($)) ?? null })
  } catch (error) {
    $.ui.log(`robot: cache TTL not saved: ${String(error)}`, { to: 'debug' })
  }
}

async function resetSettings($: EngineInterface): Promise<void> {
  // A reload runs this again while the settings are still being written: a field already at its default is not written twice.
  const saved = await $.config.list().catch(() => [])
  // The switch itself goes last, so a failed write leaves it on to try again.
  for (const [field, value] of Object.entries(DEFAULTS).sort(([a], [b]) => Number(a === 'resetSettings') - Number(b === 'resetSettings'))) {
    if (saved.find(row => row.key === `robot.${field}`)?.value === value) continue
    const set = await $.config.set({ key: `robot.${field}`, value }).catch(() => undefined)
    if (field === 'resetSettings' && set && set.deny === undefined) await $.ui.toast('Robot settings are back to default')
  }
  await $.store.delete(STORE_TTL).catch(() => undefined)
}

/** Flips one saved setting: the saved value, not this load's (a write may not have reloaded the mod yet). */
async function flipSetting($: EngineInterface, key: ToggleKey): Promise<string> {
  const { value } = (await $.config.list().catch(() => [])).find(row => row.key === `robot.${key}`) ?? {}
  const isOn = isOnOf(key, value)
  const set = await $.config.set({ key: `robot.${key}`, value: !isOn })
  return set.deny !== undefined ? toggleDenyTextOf(key, set.deny) : toggleTextOf(key, !isOn)
}

export const register: Register = (on, options) => {
  /** The tick the robot started asking for the person, or -1 when nobody is asked. */
  let needFrom = -1
  /** The desktop spinner's seed: a new robot word each turn, the same one all through it. */
  let turnSeed = ''
  /** The main spinner says it is compacting. A render hook may not write state, so the clock carries this to IS_COMPACTING. */
  let isSpinnerCompacting = false
  /** What the clock last wrote: it writes only a change, so the session.compact hook keeps its own writes. Unset after a reload, so the first tick clears a flag the last copy left on. */
  let wasSpinnerCompacting: boolean | undefined
  const hotAt = typeof options.hotAt === 'number' && options.hotAt > 0 ? options.hotAt : HOT_AT
  // The `contextFire` option turns the whole context-on-fire act off; on unless set to false.
  const isFireOn = options.contextFire !== false
  // The `calm` option: slower, quiet acts only, no cheer, factory line or branch wave; off unless set to true.
  const isCalm = options.calm === true
  const isRobotOn = options.robot !== false
  const isStatusOn = options.statusLine !== false
  const limitsAt = typeof options.limitsAt === 'number' && options.limitsAt >= 0 && options.limitsAt <= 100 ? options.limitsAt : LIMITS_AT
  const isNeedsOn = options.needsYou !== false
  const isSpinnerOn = options.robotSpinner !== false
  const isFactoryOn = options.compactFactory !== false && !isCalm
  const isCheerOn = options.gitCheer !== false && !isCalm
  const isFriendsOn = options.subagentFriends !== false
  const isWaveOn = options.branchWave !== false && !isCalm
  const isAgentLinesOn = options.agentLines !== false
  // The PR and the changed files share one line and one setting: it starts both lookups.
  const isLineOn = options.changesLine !== false
  const isUpdateOn = options.updateToast !== false
  // The `cacheCold` option turns the ice cubes and the status part off; on unless set to false.
  const isColdOn = options.cacheCold !== false
  // Which rate-limit windows the status line shows: both, or one.
  const windowKind = options.limitWindows === '5h' ? 'five_hour' : options.limitWindows === '7d' ? 'seven_day' : undefined
  const windows = windowKind ? [windowKind] : ['seven_day', 'five_hour']

  /** The organisation the person signed in with, read once a session. */
  let account: string | undefined

  // A setting changed (by /robot or /plugin) reloads the mod; session.start runs again on a reload only
  // when the plugin hooks plugin.register (types: 'session.start'). Without it the robot has no clock and stands still.
  on('plugin.register', (_$, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    if (options.resetSettings === true) await resetSettings($)

    // The clock first: nothing after it may stop the robot walking.
    $.clock.every(isCalm ? CALM_TICK_MS : TICK_MS, async () => {
      const { value: waveAt = -1 } = await $.state.get(WAVE_AT)
      const { value: at = 0 } = await $.state.get(TICK)
      await $.state.set(TICK, at + 1)
      if (waveAt >= 0 && at + 1 - waveAt >= WAVE_TICKS) await $.state.set(WAVE_AT, -1)
      const isSpinnerFactory = isFactoryOn && isSpinnerCompacting
      if (isSpinnerFactory !== wasSpinnerCompacting) {
        wasSpinnerCompacting = isSpinnerFactory
        await $.state.set(IS_COMPACTING, isSpinnerFactory)
      }
    })

    try {
      await $.command.register({ name: 'robot', description: 'Toggle the robot, `/robot status`, `/robot changes` or `/robot calm` (saved); `/robot files` and `/robot agents` open panels; `/robot play`, `/robot dice` and `/robot coin` play', argumentHint: '[status | changes | calm | files | agents | play | dice | coin]' })
    } catch (error) {
      $.ui.log(`robot: /robot not registered: ${String(error)}`, { to: 'debug' })
    }

    if (isFireOn) $.clock.every(HEAT_MS, async () => {
      try {
        const { context } = await $.session.usage()
        const percent = Math.round(context.percent ?? 0)
        const { value: was = 0 } = await $.state.get(CONTEXT_PERCENT)
        if (percent !== was) await $.state.set(CONTEXT_PERCENT, percent)
      } catch (error) {
        $.ui.log(`robot: context usage unavailable: ${String(error)}`, { to: 'debug' })
      }
    })

    if (isColdOn && (isRobotOn || isStatusOn)) {
      // Check once right away: a cold mark left in $.state (by a reload or an older version) must not wait for the first tick.
      void loadTtl($).then(() => checkCold($, options.cacheTtl))
      $.clock.every(COLD_MS, () => checkCold($, options.cacheTtl))
    }

    const checkAgents = async () => {
      if (!isFriendsOn && !isAgentLinesOn) return
      try {
        const agents = await $.agent.list()
        const live = agents.filter(agent => ['pending', 'running', 'waiting'].includes(agent.status) && agent.type !== 'teammate')
        // An agent that ended without a turn.complete (stopped, failed) leaves its line here.
        // One that started before a reload (/reload-plugins, an update) missed agent.spawn: it gets its line here.
        if (isAgentLinesOn) {
          await updateAgentRows($, rows => {
            const kept = rows.filter(row => live.some(agent => agent.id === row.id))
            const missed = live.filter(agent => !rows.some(row => row.id === agent.id))
            if (kept.length === rows.length && missed.length === 0) return rows
            const now = Date.now()
            return [...kept, ...missed.map(agent => ({ id: agent.id, type: agent.type, description: agent.description, model: '', startedAt: now, tokens: 0 }))]
          })
        }
        if (!isFriendsOn) return
        const running = live.length
        const { value: was = 0 } = await $.state.get(SUBAGENTS)
        if (running !== was) await $.state.set(SUBAGENTS, running)
      } catch (error) {
        $.ui.log(`robot: agent list unavailable: ${String(error)}`, { to: 'debug' })
      }
    }
    $.clock.every(AGENTS_MS, checkAgents)

    // An older version pinned the line as a notice; the hint line draws it now.
    $.ui.status(undefined)
    // A newer robot on main: one toast per version, fetched at most every 6 hours across sessions.
    if (isUpdateOn) {
      void checkUpdate($)
      // Ticks hourly: a tick right on the 6-hour mark can come in a few ms early and skip a whole round.
      $.clock.every(UPDATE_CHECK_MS / 6, () => checkUpdate($))
    }
    if (isStatusOn) $.clock.every(STATUS_MS, () => refreshStatus($, { account, windows, limitsAt, hotAt }))
    if (isLineOn) $.clock.every(STATUS_MS, () => refreshChanges($))
    // The PR is looked up when its time is up: soon while checks run, rarely when calm.
    if (isLineOn) $.clock.every(PR_TICK_MS, () => { if (Date.now() >= prDueAt) pokePr($, 'due', isLineOn) })
    // The first reads all at once, and the session does not wait for them: git and gh can take seconds.
    void Promise.all([
      checkAgents(),
      isStatusOn ? accountOf($).then(found => {
        account = found
        return refreshStatus($, { account, windows, limitsAt, hotAt })
      }) : undefined,
      isLineOn ? refreshPr($, 'due') : undefined,
      isLineOn ? refreshChanges($) : undefined,
    ])

    return started
  })

  // Context, cost or a rate-limit window moved: refresh the status line.
  on('session.measure', async ($, e, next) => {
    const measured = await next(e)
    if (isStatusOn) await refreshStatus($, { account, windows, limitsAt, hotAt })
    return measured
  })

  // Each model request carries the effort it asks for; the status line shows the main loop's last one.
  // Kept in $.state: the module reloads (as at the end of a turn while developing) and forgets its variables.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId && typeof e.effort === 'string') await noteEffort($, e.effort, isStatusOn, { account, windows, limitsAt, hotAt })
    const startedAt = Date.now()
    let cache = { breakMs: 0, prevPrompt: 0 }
    if (isColdOn) {
      if (e.agentId) await $.state.set(AGENT_STEP_AT, startedAt)
      else cache = await warmCache($, startedAt)
    }
    const stepped = yield* next(e)
    if (isColdOn && !e.agentId && stepped.usage) {
      await learnTtl($, cache.breakMs, stepped.usage, cache.prevPrompt)
      await $.state.set(CACHE_END_AT, Date.now())
      await $.state.set(CACHE_PROMPT, stepped.usage.cache_read_input_tokens + stepped.usage.cache_creation_input_tokens + stepped.usage.input_tokens)
    }
    // A subagent's model request: its line counts the tokens and shows the model and effort it ran with.
    if (isAgentLinesOn && e.agentId && stepped.usage) {
      const { usage } = stepped
      await updateAgentRows($, rows => (!rows.some(row => row.id === e.agentId) ? rows : rows.map(row => (row.id !== e.agentId ? row : {
        ...row,
        model: usage.model || row.model,
        effort: typeof e.effort === 'string' ? e.effort : row.effort,
        tokens: row.tokens + stepTokensOf(usage),
      }))))
    }
    return stepped
  })

  // A subagent starts: it gets a line under the status line.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (!isAgentLinesOn || started.deny !== undefined || !started.agentId || e.subagentType === 'teammate') return started
    const row: AgentRow = { id: started.agentId, type: e.subagentType, description: e.description, model: started.model, startedAt: Date.now(), tokens: 0 }
    await updateAgentRows($, rows => [...rows.filter(other => other.id !== row.id), row])
    return started
  })

  // Claude ended its turn on a question: the robot asks for the person until they send the next prompt.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) {
      await updateAgentRows($, rows => (rows.some(row => row.id === e.agentId) ? rows.filter(row => row.id !== e.agentId) : rows))
    }
    if (isNeedsOn && !e.agentId && e.reason === 'answer') await $.state.set(IS_ASKED, isQuestion(e.answer))
    return done
  })

  on('prompt.submit', async ($, e, next) => {
    await $.state.set(IS_ASKED, false)
    // A spinner that went away mid-compact leaves no render to clear the flag: the next prompt clears it, and the clock writes that.
    isSpinnerCompacting = false
    return next(e)
  })

  // The main conversation compacting, by /compact, the threshold or a plugin: the robot cools down while it runs.
  // Where an organization manages Claude Code this event skips installed plugins: the Spinner hook below covers that.
  on('session.compact', async ($, e, next) => {
    if (!isFactoryOn || e.trigger === 'precompute' || e.agentId) return next(e)
    await $.state.set(IS_COMPACTING, true)
    try {
      return await next(e)
    } finally {
      await $.state.set(IS_COMPACTING, false)
    }
  })

  // Claude changed a file: the changed-files line counts again.
  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, async ($, e, next) => {
    const ran = await next(e)
    if (isLineOn && ran.deny === undefined) await refreshChanges($)
    return ran
  })

  // A git commit or push that went through: the robot cheers for CELEBRATE_TICKS and the branch waves. Subagent commands count too.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    // A push, a branch change or a `gh pr` act moves the PR: look it up at once, without holding the tool's result.
    if (isLineOn && ran.deny === undefined && isPrActOf(e.command)) {
      prActAt = Date.now()
      pokePr($, 'now', isLineOn)
    }
    // Any command may change, add or commit files.
    if (isLineOn && ran.deny === undefined) await refreshChanges($)
    if (!isCheerOn && !isWaveOn) return ran
    if (ran.deny !== undefined || ran.isError === true) return ran
    const act = gitActOf(e.command)
    if (!act) return ran
    const { value: at = 0 } = await $.state.get(TICK)
    if (isCheerOn) await $.state.set(CELEBRATION, { act, at })
    if (isWaveOn) await $.state.set(WAVE_AT, at)
    return ran
  })

  on('turn.start', async ($, e, next) => {
    turnSeed = String(randomInt())
    return next(e)
  })

  // The spinner word becomes a robot word, stable for the turn. The engine keeps its elapsed/tokens and the ellipsis.
  // It also tells the clock when the spinner says the conversation is compacting.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    isSpinnerCompacting = isCompactingMessage(e.props.message)
    if (!isSpinnerOn || e.props.message !== null) return next(e)
    if (e.surface !== 'terminal' && e.props.word !== 'Working') return next(e)
    const seed = e.surface === 'terminal' ? e.props.word : turnSeed
    return next({ ...e, props: { ...e.props, word: robotWord(seed) } })
  })

  on('command.run', { command: 'robot' }, async ($, e) => {
    const command = commandOf(e.args)
    if (command.kind === 'files') {
      await openChanges($)
      return { text: 'Changed files.' }
    }
    if (command.kind === 'agents') {
      await openAgents($)
      return { text: 'Subagents.' }
    }
    if (command.kind === 'toggle') return { text: await flipSetting($, command.key) }
    if (command.kind === 'act') {
      const { act } = command
      const value = act === 'dice' ? 1 + (randomInt() % 6) : act === 'coin' ? randomInt() % 2 : 0
      // The robot shows the result, so the reply stays empty: no spoiler before it lands.
      if (isRobotOn) {
        await $.state.set(ACT, { id: Date.now(), name: act, value })
        return {}
      }
      if (act === 'slot') return { text: 'The robot is hidden: /robot shows it.' }
      return { text: actTextOf(act, value) }
    }
    return { text: HELP_TEXT }
  })

  // The status line: a row of coloured parts above Claude Code's own hint line, which stays as it is.
  // The status line, then one line for each running subagent: rows above Claude Code's own hint line, which stays as it is.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!isStatusOn && !isAgentLinesOn && !isLineOn) return next(e)
    const { value: status = [] } = await $.state.get(STATUS)
    const { value: agentRows = [] } = isAgentLinesOn ? await $.state.get(AGENT_ROWS) : { value: [] }
    const { value: changes = [] } = isLineOn ? await $.state.get(CHANGES) : { value: [] }
    const { value: pr = NO_PR } = isLineOn ? await $.state.get(CHANGES_PR) : { value: undefined }
    const { value: prInfo = NO_PR_INFO } = isLineOn ? await $.state.get(PR) : { value: undefined }
    const { value: coldTokens = 0 } = isColdOn && isStatusOn ? await $.state.get(COLD_TOKENS) : { value: 0 }
    const theirs = await next(e)
    // A few cells of room for the line's indent and the right edge.
    const columns = (e.viewport?.columns ?? 80) - STATUS_MARGIN
    const lines: Span[][] = []
    const { value: waveAt = -1 } = await $.state.get(WAVE_AT)
    if (isStatusOn && status.length > 0) {
      let groups = status.filter(group => Array.isArray(group.spans))
      // The shimmer module runs its own fast clock, so the line itself does not redraw while the branch shimmers.
      if (isWaveOn && waveAt >= 0) groups = wavedOf(groups)
      if (coldTokens > 0) groups = [...groups, coldGroupOf(coldTokens)]
      lines.push(fitStatus(groups, columns))
    }
    // The agent lines go under the PR and files line.
    const agentLines: Span[][] = []
    // The index of the `+N more` line, a button that opens the panel with all of them.
    let moreAt = -1
    if (agentRows.length > 0) {
      // Reading the tick redraws the lines 4 times a second, so each agent's time runs; only while agents run.
      await $.state.get(TICK)
      const now = Date.now()
      for (const row of agentRows.slice(0, MAX_AGENT_LINES)) agentLines.push([AGENT_MARK, ...fitStatus(agentGroupsOf(row, now), columns - AGENT_MARK.text.length)])
      const more = moreOf(agentRows.length)
      if (more.length > 0) agentLines.push([AGENT_MARK, ...more])
      moreAt = more.length > 0 ? agentLines.length - 1 : -1
    }
    // The open PR (a link to it, and what needs the person), then the changed files: one line.
    // The files are a button that opens the panel with the list.
    const row = prRowOf(isLineOn ? prLineOf(prInfo) : [], changesGroupsOf(pr.number > 0 ? pr : totalsOf(changes as FileChange[])), columns)
    const changed = row.changed
    if (lines.length === 0 && agentLines.length === 0 && row.pr.length === 0 && changed.length === 0) return theirs
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    // Mobile and the IDE draw no Client: there the branch stays still, in its blue.
    const Client = 'Client' in elements ? elements.Client : undefined
    const Link = 'Link' in elements ? elements.Link : undefined
    const spanOf = (span: Span) =>
      span.color === SHIMMER && Client ? (
        <Client key={`shimmer-${waveAt}`} module="./shimmer.tsx" props={{ text: span.text, frames: SHIMMER_FRAMES }} />
      ) : span.href && Link ? (
        <Text color={span.color || undefined} wrap="truncate">
          <Link href={span.href}>{span.text}</Link>
        </Text>
      ) : (
        <Text color={span.color === SHIMMER ? 'ide' : span.color || undefined} wrap="truncate">
          {span.text}
        </Text>
      )
    return (
      <Box flexDirection="column">
        {lines.map(spans => (
          <Box>{spans.map(spanOf)}</Box>
        ))}
        {(row.pr.length > 0 || changed.length > 0) && (
          <Box>
            {/* prRowOf already fits the PR info: it must not shrink, or the files part squeezes it. */}
            <Box flexShrink={0}>
              {row.pr.map(spanOf)}
              {row.pr.length > 0 && changed.length > 0 && <Text color={PR_ROW_SEPARATOR.color}>{PR_ROW_SEPARATOR.text}</Text>}
            </Box>
            {changed.length > 0 && (
              Client ? (
                // Under the pointer it shimmers as the panel's rows do; a click opens the panel.
                <Box flexGrow={1}>
                  <Client key="changes" module="./changes-line.tsx" width="100%" props={{ spans: changed.map(span => ({ text: span.text, color: span.color })) }} />
                </Box>
              ) : (
                <Button key="changes" plain onPress={() => void openChanges($)}>
                  {changed.map(span => (
                    <Text color={span.color || undefined}>{span.text}</Text>
                  ))}
                </Button>
              )
            )}
          </Box>
        )}
        {agentLines.map((spans, i) =>
          i === moreAt ? (
            Client ? (
              // Like the changed-files line: it shimmers under the pointer; a click opens the panel.
              <Client key="agents-more" module="./changes-line.tsx" width="100%" props={{ spans: spans.map(span => ({ text: span.text, color: span.color })) }} />
            ) : (
              <Button key="agents-more" plain onPress={() => void openAgents($)}>
                {spans.map(spanOf)}
              </Button>
            )
          ) : (
            <Box>{spans.map(spanOf)}</Box>
          ),
        )}
        {theirs}
      </Box>
    )
  })

  // The changed-files panel: each file with its added and removed lines, as git counts them.
  on('ui.render', { component: 'Pane', requestId: CHANGES_PANE }, async ($, e) => {
    const { value: changes = [] } = await $.state.get(CHANGES)
    const { value: query = '' } = await $.state.get(CHANGES_QUERY)
    const { value: preview = NO_PREVIEW } = await $.state.get(CHANGES_PREVIEW)
    const { value: cursor = '' } = await $.state.get(CHANGES_CURSOR)
    const { value: pr = NO_PR } = await $.state.get(CHANGES_PR)
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    // The mobile app draws no field and no code block: there the list shows whole, and a diff as plain text.
    const Input = 'Input' in elements ? elements.Input : undefined
    const Code = 'Code' in elements ? elements.Code : undefined
    const Link = 'Link' in elements ? elements.Link : undefined
    const Client = 'Client' in elements ? elements.Client : undefined
    const columns = Math.max(20, e.props.bodyColumns - 2)

    // A file picked: its diff, as filetree previews a file, with a way back and a way out.
    if (preview.path) {
      const change = changes.find(other => other.path === preview.path && other.group === preview.group)
      return (
        <Box flexDirection="column" paddingX={1}>
          <Box flexDirection="row">
            <Button key="back" plain label="← files" hotkey="b" onPress={() => void $.state.set(CHANGES_PREVIEW, NO_PREVIEW)} />
            <Text> </Text>
            <Box flexShrink={1} flexGrow={1}>
              <Text bold wrap="truncate-start">{preview.path}</Text>
            </Box>
            {change && <Text color="success">{change.added > 0 ? ` +${change.added}` : ''}</Text>}
            {change && <Text color="error">{change.removed > 0 ? ` -${change.removed}` : ''}</Text>}
            <Text> </Text>
            <Button key="external" plain dimColor label="↗ open" hotkey="o" onPress={() => void openExternally($, `${preview.root}/${preview.path}`)} />
          </Box>
          {!preview.diff.trim() ? (
            <Text color="inactive">No changes to show</Text>
          ) : Code ? (
            <Code source={preview.diff} format="diff" path={preview.path} />
          ) : (
            <Text>{preview.diff}</Text>
          )}
        </Box>
      )
    }

    const isPr = pr.number > 0
    const files = isPr ? pr.files : totalsOf(changes).files
    // Marks take two cells on the left; the list fills the rest.
    const rows = listRowsOf(changes, query, isPr, columns - 2)
    return (
      <Box flexDirection="column" paddingX={1}>
        {files > 0 ? (
          <Text>
            {isPr && Link && pr.url ? <Link href={pr.url}>{`PR #${pr.number}`}</Link> : isPr ? <Text bold>{`PR #${pr.number}`}</Text> : null}
            {isPr && <Text color="inactive">{' · '}</Text>}
            <Text bold>{countOf(files)}</Text>
          </Text>
        ) : (
          <Text bold>No changed files</Text>
        )}
        {/* Typing filters the list; ↓ walks the files, the pointer lights the one under it. */}
        {Input && <Input key="search" placeholder="Search files" value={query} autoFocus onInput={value => void $.state.set(CHANGES_QUERY, value)} onSubmit={() => undefined} />}
        {Client ? (
          // The filetree way: a soft background and a shimmer on the row under the pointer.
          // ↑ ↓ walk the engine's focus ring, so each file has a one-cell mark in it (a
          // heading none); the ui.focus hook hands the list the mark's row, Enter presses it.
          <Box flexDirection="row">
            <Box flexDirection="column" width={2}>
              {rows.map((row, i) =>
                row.heading ? (
                  <Text> </Text>
                ) : (
                  <Button key={`row-${i}`} plain onPress={() => void previewChange($, row.path, row.group)}>
                    <Text> </Text>
                  </Button>
                ),
              )}
              <Text> </Text>
              <Button key="close-mark" plain onPress={() => void $.ui.close({ id: CHANGES_PANE })}>
                <Text> </Text>
              </Button>
            </Box>
            {/* A Client's tree holds at most 100,000 characters: a long list is drawn in parts, the last with the Close row. */}
            <Box flexGrow={1} flexDirection="column">
              {partsOf(rows.length).map(start => {
                const at = cursorOf(cursor, rows.length)
                const part = rows.slice(start, start + LIST_PART)
                const isLast = start + LIST_PART >= rows.length
                return (
                  <Client
                    key={`files-${start}`}
                    module="./files-list.tsx"
                    width={columns - 2}
                    props={{ rows: part, cursor: (at >= start && at < start + part.length) || (isLast && at === start + part.length + 1) ? at - start : -1, hasClose: isLast }}
                  />
                )
              })}
            </Box>
          </Box>
        ) : (
          <Box key="files" flexDirection="column">
            {rows.map(row =>
              row.heading ? (
                <Text bold color="inactive">{row.heading}</Text>
              ) : (
                <Button key={`${row.group}:${row.path}`} plain onPress={() => void previewChange($, row.path, row.group)}>
                  <Text bold>{row.name}</Text>
                  <Text color="inactive">{row.folder ? ` ${row.folder}` : ''}</Text>
                  <Text color="success">{row.added > 0 ? ` +${row.added}` : ''}</Text>
                  <Text color="error">{row.removed > 0 ? ` -${row.removed}` : ''}</Text>
                  <Text color={STATUS_COLORS[row.status]}>{` ${row.status}`}</Text>
                </Button>
              ),
            )}
          </Box>
        )}
        {changes.length > 0 && rows.length === 0 && <Text color="inactive">No file matches</Text>}
        {!Client && (
          <Box marginTop={1}>
            <Button key="close" label="Close" hotkey="c" onPress={() => void $.ui.close({ id: CHANGES_PANE })} />
          </Box>
        )}
      </Box>
    )
  })

  // The subagents panel: every running agent, one line each; it redraws as the rows and the tick change.
  on('ui.render', { component: 'Pane', requestId: AGENTS_PANE }, async ($, e) => {
    const { value: agentRows = [] } = await $.state.get(AGENT_ROWS)
    if (agentRows.length > 0) await $.state.get(TICK)
    const { Box, Text, Button } = $.ui.resolve(e)
    const spanOf = (span: Span) => <Text color={span.color || undefined} wrap="truncate">{span.text}</Text>
    const lines = agentPaneLinesOf(agentRows, Date.now(), Math.max(20, e.props.bodyColumns - 2), AGENT_MARK)
    return (
      <Box flexDirection="column" paddingX={1}>
        {lines.map(spans => (
          <Box>{spans.map(spanOf)}</Box>
        ))}
        <Box marginTop={1}>
          <Button key="close" label="Close" hotkey="c" onPress={() => void $.ui.close({ id: AGENTS_PANE })} />
        </Box>
      </Box>
    )
  })

  on('ui.focus', { component: 'Pane', requestId: CHANGES_PANE }, async ($, e, next) => {
    const result = await next(e)
    if (!result.deny) await $.state.set(CHANGES_CURSOR, e.element ?? '')
    return result
  })

  // The changed-files line clicked: the panel opens.
  on('ui.message', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.element === 'agents-more') {
      await openAgents($)
      return {}
    }
    if (e.element !== 'changes') return next(e)
    await openChanges($)
    return {}
  })

  // A file picked in the list (a second click): the panel previews its diff. Close closes it.
  on('ui.message', async ($, e, next) => {
    if (e.requestId !== CHANGES_PANE || !e.element?.startsWith('files-')) return next(e)
    const { pick, group, close } = (e.data ?? {}) as { pick?: unknown; group?: unknown; close?: unknown }
    if (close === true) await $.ui.close({ id: CHANGES_PANE })
    else if (typeof pick === 'string' && pick) await previewChange($, pick, group === 'pr' ? 'pr' : 'local')
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const columns = e.props.bodyColumns
    const { value: at = 0 } = await $.state.get(TICK)
    // An agent's transcript in view (opened from the tasks list): the robot steps aside.
    const isQuiet = !isRobotOn || e.props.hasSurvey || e.props.maxRows < ROWS || e.props.view?.agentId !== undefined
    if (isQuiet) {
      return next(e)
    }

    const { value: percent = 0 } = await $.state.get(CONTEXT_PERCENT)
    const { value: act } = await $.state.get(ACT)
    const { value: isCompacting = false } = await $.state.get(IS_COMPACTING)
    const { value: celebration } = await $.state.get(CELEBRATION)
    const { value: subagents = 0 } = await $.state.get(SUBAGENTS)
    const isCelebrating = !isCompacting && celebration !== undefined && at - celebration.at < CELEBRATE_TICKS
    const { value: coldTokens = 0 } = isColdOn ? await $.state.get(COLD_TOKENS) : { value: 0 }
    const isCold = coldTokens > 0
    // Cold beats fire: the frozen robot shows no flames.
    const isHot = isFireOn && percent >= hotAt && !isCold
    // Only once the turn is over: a working engine means the person already answered.
    const { value: isAsked = false } = await $.state.get(IS_ASKED)
    const isNeeded = isNeedsOn && isAsked && !e.props.isWorking
    if (!isNeeded) needFrom = -1
    else if (needFrom < 0) needFrom = at
    if (!isCompacting) packedFrom = -1
    else if (packedFrom < 0) {
      packedFrom = at
      packedSeed = randomInt()
    }

    // The subagent friends keep the right edge; the robot walks left of them. A robot already in their zone when they
    // come is not snapped out: it turns and walks out, and the friends show once their cells are free.
    const zone = friendsZone(subagents)
    const zoneTrack = Math.max(MIN_TRACK, columns - BODY_CELLS - zone)
    if (shown.state.pos >= zoneTrack && shown.state.state === 'walk') shown.state = { ...shown.state, dir: -1 }
    const track = Math.max(zoneTrack, Math.min(shown.state.pos + 1, columns - BODY_CELLS))
    // An act asked for by a command starts now; it plays to its end whatever the robot felt before.
    // Drawing is pure (no state writes), so the started id is kept in this module.
    if (actSeen === undefined) actSeen = act?.id ?? 0
    else if (act && act.id !== actSeen) {
      actSeen = act.id
      shown.state = actOf(shown.state, act.name, act.value, track)
    }
    // While compacting or celebrating the robot stands still: the factory line runs across the band.
    if (at !== shown.at && !isCompacting && (isNeeded || !isCelebrating)) {
      // Hot: drop everything; walk, then stop and wave its arms (dance), until it cools.
      // Talking (asking for the person, or hot and talking) it dances in place, so its bubble stays put.
      // An act in play is not overridden.
      const wanted = isInAct(shown.state) ? undefined : isNeeded || (isHot && talkAt(at) >= 0) ? 'dance' : isHot ? 'walk' : undefined
      if (wanted && !(shown.state.state === wanted && shown.state.dur === FOREVER)) {
        shown.state = { ...shown.state, state: wanted, t: 0, dur: FOREVER }
      } else if (!wanted && shown.state.dur === FOREVER) {
        shown.state = { ...shown.state, dur: shown.state.t }
      }
      // Cold: the robot freezes where it stands. An act plays every tick, cold or hot.
      if (!shown.frame || isInAct(shown.state) || (!isCold && (!isHot || isHotStep(at)))) {
        const drawn = step(shown.state, track, randomInt, isCalm ? CALM_STATES : undefined)
        shown.state = drawn.state
        shown.frame = drawn.frame
      }
      shown.at = at
    }
    // The friends roll one cell per new tick, whatever the robot does.
    if (at !== friendsAt) {
      friends = stepFriends(friends, subagents, nextFriendId)
      friendsAt = at
    }
    // Priority: compacting, then needs-you, then celebrating, then the robot as it walks (hot or not).
    // Cold ice, or fire; cold wins (isHot is already false then).
    // An act draws its own frames: no fire, no ice, no bubble, no friends.
    const inAct = isInAct(shown.state)
    const decorated = (f: Frame) => (inAct ? f : isCold ? chilled(f, true, at) : heated(f, isHot, at))
    // Words go left of the friends' zone; if they fit nowhere there, they take the whole band and hide the friends under them.
    const spoken = (f: Frame, said: Span[][]) => {
      const kept = speech(f, said, columns - zone)
      return kept === f ? speech(f, said, columns) : kept
    }
    let frame: Frame
    if (isCompacting) {
      frame = factory(columns, at - packedFrom, packedSeed)
    } else if (isNeeded) {
      if (!shown.frame) return next(e)
      // An act wins over needs-you: it plays plain, with no bubble and no friends.
      if (inAct) {
        frame = shown.frame
      } else {
        const said = typedSoFar(NEEDS_YOU_SAY, (at - needFrom + 1) * TYPE_SPEED)
        frame = withFriends(spoken(decorated(shown.frame), said), columns, friends, subagents, at, isHot ? 'hot' : 'normal')
      }
    } else if (isCelebrating && celebration) {
      frame = withFriends(celebrating(shown.state.pos, columns - zone, celebration.act, at - celebration.at), columns, friends, subagents, at, 'cheer')
    } else if (!shown.frame) {
      return next(e)
    } else {
      const said = !inAct && (isHot || isCold) && talkAt(at) >= 0 ? typedSoFar(isHot ? sayOf(percent) : COLD_SAY, (talkAt(at) + 1) * TYPE_SPEED) : undefined
      // Words stay left of the friends' zone, so the friends keep their cells.
      const robot = said ? spoken(decorated(shown.frame), said) : decorated(shown.frame)
      // The cat act fills both sides of the robot: the friends stay out of it.
      frame = shown.state.state === 'catpeek' || inAct
        ? robot
        : withFriends(robot, columns, friends, subagents, at, isHot ? 'hot' : 'normal')
    }

    // A row wider than the band (bubble, robot and friends at a narrow width) is cut at the edge.
    frame = clipped(frame, columns)

    const els = $.ui.resolve(e)
    if (e.surface !== 'terminal' && 'Svg' in els) {
      const { Box, Svg } = els
      return (
        <Box width={columns}>
          <Svg
            source={svgOf(frame, columns)}
            alt="A little ASCII robot"
            width={columns * CELL_WIDTH}
            height={frame.length * ROW_HEIGHT}
          />
        </Box>
      )
    }

    const { Box, Text } = els

    return (
      <Box flexDirection="column" width={columns}>
        {frame.map(row => (
          <Box>
            {row.length === 0 ? (
              <Text> </Text>
            ) : (
              row.map(span => (
                <Text color={span.color === SHIMMER ? 'ide' : span.color || undefined} wrap="truncate">
                  {span.text}
                </Text>
              ))
            )}
          </Box>
        ))}
      </Box>
    )
  })
}
