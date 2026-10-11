import type { EngineInterface, Register } from 'claude-code'

import { CELL_WIDTH, COMMAND_COLOR, DEFAULT_COLOR, ROW_HEIGHT, celebrating, heated, factory, speech, svgOf, typedSoFar, withFriends } from './frames'
import type { Frame, Span } from './frames'
import { stepFriends } from './friends'
import type { Friend } from './friends'
import { gitActOf } from './git'
import { INITIAL, randomInt, step } from './robot'
import type { RobotState } from './robot'
import { isQuestion } from './ask'
import { robotWord } from './spinner'
import { accountNameOf, fitStatus, groupsOf, SHIMMER, wavedOf } from './statusline'
import { MAX_AGENT_LINES, agentGroupsOf, moreOf, stepTokensOf } from './agents'
import type { AgentRow } from './agents'
import { MAX_NEW_FILES, changesGroupsOf, changesOf, countsOf, listRowOf, localOf, matchesOf, numstatOf, prChangesOf, rowOf, titleOf } from './changes'
import type { FileChange } from './changes'
import type { RateLimit } from './statusline'

const TICK_MS = 250
const ROWS = 4
// The robot body is ten cells wide; keep it whole at the right edge.
const BODY_CELLS = 10
const MIN_TRACK = 12
const HEAT_MS = 2000
// Default context usage (percent) at which the head catches fire; the `hotAt` option overrides it.
const HOT_AT = 25
// An animation that never ends by itself: how the robot is held walking or dancing while hot.
const FOREVER = Number.MAX_SAFE_INTEGER
// Hot pace, in ticks (4 a second): every 30 seconds it stops, waves its arms and talks for TALK ticks;
// the rest of the time it walks for PACE_WALK ticks, then stands still for the rest of PACE.
const TALK_EVERY = 120
const TALK = 32
const PACE = 48
const PACE_WALK = 32
// A git commit or push is celebrated for 3 seconds, at 4 ticks a second.
const CELEBRATE_TICKS = 12
// The branch name waves for 3 seconds, at 4 ticks a second.
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
const IS_HIDDEN = { plugin: 'robot', key: 'isHidden' } as const
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
const CHANGES_QUERY = { plugin: 'robot', key: 'changesQuery' } as const
/** The file the panel previews, with its diff; no path: the panel lists the files. */
const CHANGES_PREVIEW = { plugin: 'robot', key: 'changesPreview' } as const
/** The key of the list mark the panel's focus ring is on: `row-3`, `close-mark`, or none. */
const CHANGES_CURSOR = { plugin: 'robot', key: 'changesCursor' } as const
/** The branch's open PR (`number` 0: none) and the commit its diff starts from (HEAD with none). */
const CHANGES_PR = { plugin: 'robot', key: 'changesPr' } as const
/** The most of a diff the preview draws. */
const MAX_DIFF_CHARS = 60_000
/** The panel that lists the changed files. */
const CHANGES_PANE = 'robot-files'

/** The robot as of the last tick drawn: its state, which tick, and that tick's frame. */
const shown: { state: RobotState; at: number; frame: Frame | undefined } = { state: INITIAL, at: -1, frame: undefined }
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
    const git = await $.process.run(['git', '-C', cwd, 'branch', '--show-current']).catch(() => undefined)
    const branch = git?.exitCode === 0 ? git.stdout.trim() : undefined
    // A new branch waves; the first one a session reads does not.
    const { value: was } = await $.state.get(BRANCH)
    if ((branch ?? '') !== was) {
      await $.state.set(BRANCH, branch ?? '')
      if (was !== undefined && branch) await startWave($)
    }
    await $.state.set(STATUS, groupsOf({
      account,
      model,
      effort,
      project: cwd.split('/').filter(Boolean).at(-1),
      branch,
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

/** How long a PR lookup holds before `gh` is asked again. */
const PR_MS = 60_000
/** The last PR lookup: the branch it was for, when, and the PR (0: none open). Starts over on a reload. */
let prLookup = { key: '', at: 0, number: 0, baseRef: '' }

/** The open PR of the branch at `root`, by `gh`, kept for a minute; none when `gh` is missing or not signed in. */
async function prOf($: EngineInterface, git: Git, root: string): Promise<{ number: number; baseRef: string }> {
  const branch = (await git(['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
  const key = `${root}\n${branch}`
  if (prLookup.key === key && Date.now() - prLookup.at < PR_MS) return prLookup
  const found = await $.process.run(['gh', 'pr', 'view', '--json', 'number,baseRefName,state'], { cwd: root, timeoutMs: 5_000 }).catch(() => undefined)
  let pr = { number: 0, baseRef: '' }
  try {
    const view = found?.exitCode === 0 ? (JSON.parse(found.stdout) as { number?: number; baseRefName?: string; state?: string }) : {}
    if (view.state === 'OPEN' && view.number) pr = { number: view.number, baseRef: view.baseRefName ?? '' }
  } catch {
    // Not JSON: no PR known.
  }
  prLookup = { key, at: Date.now(), ...pr }
  return pr
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
 * Reads the changed files. With no PR open: what `git` would commit, each
 * changed or new file. With one open: every file of the PR, committed or not,
 * plus the new files; the ones not committed yet are marked.
 */
async function refreshChanges($: EngineInterface): Promise<void> {
  try {
    const cwd = await $.session.cwd()
    const git: Git = args => $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs: 5_000, env: { GIT_OPTIONAL_LOCKS: '0' } })
    const top = await git(['rev-parse', '--show-toplevel'])
    if (top.exitCode !== 0) return
    const root = top.stdout.trim()
    const pr = await prOf($, git, root)
    const base = pr.number > 0 ? await baseOf(git, root, pr.baseRef) : 'HEAD'
    const local = await git(['-C', root, 'diff', '--no-renames', '--numstat', 'HEAD'])
    const others = await git(['-C', root, 'ls-files', '--others', '--exclude-standard'])
    const paths = others.exitCode === 0 ? others.stdout.split('\n').filter(Boolean) : []
    // A new file's lines come from a diff against nothing; past MAX_NEW_FILES they are not counted.
    const fresh: FileChange[] = await Promise.all(paths.map(async (path, i) => {
      if (i >= MAX_NEW_FILES) return { path, added: 0, removed: 0 }
      const counted = await git(['-C', root, 'diff', '--no-index', '--numstat', '--', '/dev/null', path])
      return { path, added: numstatOf(counted.stdout)[0]?.added ?? 0, removed: 0 }
    }))
    const uncommitted = local.exitCode === 0 ? numstatOf(local.stdout) : []
    let changes = changesOf(uncommitted, fresh)
    if (base !== 'HEAD') {
      const sincePr = await git(['-C', root, 'diff', '--no-renames', '--numstat', base])
      const isLocal = new Set(changes.map(change => change.path))
      changes = prChangesOf(sincePr.exitCode === 0 ? numstatOf(sincePr.stdout) : [], fresh, isLocal)
    }
    const prNow = { number: base !== 'HEAD' ? pr.number : 0, base }
    const { value: was = [] } = await $.state.get(CHANGES)
    if (JSON.stringify(was) !== JSON.stringify(changes)) await $.state.set(CHANGES, changes)
    const { value: wasPr } = await $.state.get(CHANGES_PR)
    if (JSON.stringify(wasPr) !== JSON.stringify(prNow)) await $.state.set(CHANGES_PR, prNow)
  } catch (error) {
    $.ui.log(`robot: changed files unavailable: ${String(error)}`, { to: 'debug' })
  }
}

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
  await $.state.set(CHANGES_PREVIEW, { path: '', root: '', diff: '' })
  await $.state.set(CHANGES_CURSOR, '')
  const opened = await $.ui.open({ id: CHANGES_PANE, title: 'Changed files', focus: true, closeOnEscape: true })
  if (!opened.isPlaced) $.ui.toast('robot: no room for the changed files panel')
}

/** Shows a changed file's diff in the panel: against HEAD, or with a PR open, the PR's whole diff; a new file shows whole, as added. */
async function previewChange($: EngineInterface, path: string): Promise<void> {
  const { value: pr = { number: 0, base: 'HEAD' } } = await $.state.get(CHANGES_PR)
  const cwd = await $.session.cwd()
  const git = (args: string[]) => $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs: 5_000, env: { GIT_OPTIONAL_LOCKS: '0' } })
  const top = await git(['rev-parse', '--show-toplevel'])
  const root = top.stdout.trim()
  const tracked = await git(['-C', root, 'diff', '--no-renames', pr.base || 'HEAD', '--', path])
  const diff = tracked.stdout.trim() ? tracked.stdout : (await git(['-C', root, 'diff', '--no-index', '--', '/dev/null', path])).stdout
  await $.state.set(CHANGES_PREVIEW, { path, root, diff: diff.slice(0, MAX_DIFF_CHARS) })
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
  robot: true, statusLine: true, contextFire: true, hotAt: 25, compactFactory: true, gitCheer: true,
  subagentFriends: true, limitWindows: 'both', limitsAt: 0, needsYou: true, robotSpinner: true, branchWave: true, agentLines: true, changedFiles: true, resetSettings: false,
}

async function resetSettings($: EngineInterface): Promise<void> {
  // The switch itself goes last, so a failed write leaves it on to try again.
  for (const [field, value] of Object.entries(DEFAULTS).sort(([a], [b]) => Number(a === 'resetSettings') - Number(b === 'resetSettings'))) {
    await $.config.set({ key: `robot.${field}`, value }).catch(() => undefined)
  }
  await $.ui.toast('Robot settings are back to default')
}

export const register: Register = (on, options) => {
  /** The tick the robot started asking for the person, or -1 when nobody is asked. */
  let needFrom = -1
  /** The desktop spinner's seed: a new robot word each turn, the same one all through it. */
  let turnSeed = ''
  const hotAt = typeof options.hotAt === 'number' && options.hotAt > 0 ? options.hotAt : HOT_AT
  // The `contextFire` option turns the whole context-on-fire act off; on unless set to false.
  const isFireOn = options.contextFire !== false
  const isRobotOn = options.robot !== false
  const isStatusOn = options.statusLine !== false
  const limitsAt = typeof options.limitsAt === 'number' && options.limitsAt >= 0 && options.limitsAt <= 100 ? options.limitsAt : LIMITS_AT
  const isNeedsOn = options.needsYou !== false
  const isSpinnerOn = options.robotSpinner !== false
  const isFactoryOn = options.compactFactory !== false
  const isCheerOn = options.gitCheer !== false
  const isFriendsOn = options.subagentFriends !== false
  const isWaveOn = options.branchWave !== false
  const isAgentLinesOn = options.agentLines !== false
  const isChangesOn = options.changedFiles !== false
  // Which rate-limit windows the status line shows: both, or one.
  const windowKind = options.limitWindows === '5h' ? 'five_hour' : options.limitWindows === '7d' ? 'seven_day' : undefined
  const windows = windowKind ? [windowKind] : ['seven_day', 'five_hour']

  /** The organisation the person signed in with, read once a session. */
  let account: string | undefined

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    if (options.resetSettings === true) await resetSettings($)
    await $.command.register({ name: 'robot', description: 'Hide or show the robot above the prompt; `/robot files` lists the changed files' })

    $.clock.every(TICK_MS, async () => {
      const { value: hidden = false } = await $.state.get(IS_HIDDEN)
      const { value: waveAt = -1 } = await $.state.get(WAVE_AT)
      // The wave counts ticks; while hidden they stop, so the wave ends at once.
      if (hidden) {
        if (waveAt >= 0) await $.state.set(WAVE_AT, -1)
        return
      }
      const { value: at = 0 } = await $.state.get(TICK)
      await $.state.set(TICK, at + 1)
      if (waveAt >= 0 && at + 1 - waveAt >= WAVE_TICKS) await $.state.set(WAVE_AT, -1)
    })

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

    $.clock.every(AGENTS_MS, async () => {
      if (!isFriendsOn && !isAgentLinesOn) return
      try {
        const agents = await $.agent.list()
        const live = agents.filter(agent => ['pending', 'running', 'waiting'].includes(agent.status) && agent.type !== 'teammate')
        // An agent that ended without a turn.complete (stopped, failed) leaves its line here.
        await updateAgentRows($, rows => {
          const kept = rows.filter(row => live.some(agent => agent.id === row.id))
          return kept.length !== rows.length ? kept : rows
        })
        if (!isFriendsOn) return
        const running = live.length
        const { value: was = 0 } = await $.state.get(SUBAGENTS)
        if (running !== was) await $.state.set(SUBAGENTS, running)
      } catch (error) {
        $.ui.log(`robot: agent list unavailable: ${String(error)}`, { to: 'debug' })
      }
    })

    // An older version pinned the line as a notice; the hint line draws it now.
    $.ui.status(undefined)
    if (isStatusOn) {
      account = await accountOf($)
      await refreshStatus($, { account, windows, limitsAt, hotAt })
      $.clock.every(STATUS_MS, () => refreshStatus($, { account, windows, limitsAt, hotAt }))
    }
    if (isChangesOn) {
      await refreshChanges($)
      $.clock.every(STATUS_MS, () => refreshChanges($))
    }

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
    const stepped = yield* next(e)
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
    return next(e)
  })

  // The main conversation compacting, by /compact, the threshold or a plugin: the robot cools down while it runs.
  on('session.compact', async ($, e, next) => {
    if (!isFactoryOn || e.trigger === 'precompute' || e.agentId) return next(e)
    await $.state.set(IS_COMPACTING, true)
    try {
      return await next(e)
    } finally {
      await $.state.set(IS_COMPACTING, false)
    }
  })

  // A git commit or push that went through: the robot cheers for CELEBRATE_TICKS and the branch waves. Subagent commands count too.
  // Claude changed a file: the changed-files line counts again.
  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, async ($, e, next) => {
    const ran = await next(e)
    if (isChangesOn && ran.deny === undefined) await refreshChanges($)
    return ran
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    // Any command may change, add or commit files.
    if (isChangesOn && ran.deny === undefined) await refreshChanges($)
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
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!isSpinnerOn || e.props.message !== null) return next(e)
    if (e.surface !== 'terminal' && e.props.word !== 'Working') return next(e)
    const seed = e.surface === 'terminal' ? e.props.word : turnSeed
    return next({ ...e, props: { ...e.props, word: robotWord(seed) } })
  })

  on('command.run', { command: 'robot' }, async ($, e) => {
    if (e.args.trim() === 'files') {
      await openChanges($)
      return { text: 'Changed files.' }
    }
    const { value: was = false } = await $.state.get(IS_HIDDEN)
    const hidden = !was
    await $.state.set(IS_HIDDEN, hidden)

    return { text: hidden ? 'Robot hidden.' : 'Robot is back.' }
  })

  // The status line: a row of coloured parts above Claude Code's own hint line, which stays as it is.
  // The status line, then one line for each running subagent: rows above Claude Code's own hint line, which stays as it is.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!isStatusOn && !isAgentLinesOn && !isChangesOn) return next(e)
    const { value: status = [] } = await $.state.get(STATUS)
    const { value: agentRows = [] } = isAgentLinesOn ? await $.state.get(AGENT_ROWS) : { value: [] }
    const { value: changes = [] } = isChangesOn ? await $.state.get(CHANGES) : { value: [] }
    const { value: pr = { number: 0, base: 'HEAD' } } = isChangesOn ? await $.state.get(CHANGES_PR) : { value: undefined }
    const theirs = await next(e)
    // A few cells of room for the line's indent and the right edge.
    const columns = (e.viewport?.columns ?? 80) - STATUS_MARGIN
    const lines: Span[][] = []
    const { value: waveAt = -1 } = await $.state.get(WAVE_AT)
    if (isStatusOn && status.length > 0) {
      let groups = status.filter(group => Array.isArray(group.spans))
      // The shimmer module runs its own fast clock, so the line itself does not redraw while the branch shimmers.
      if (isWaveOn && waveAt >= 0) groups = wavedOf(groups)
      lines.push(fitStatus(groups, columns))
    }
    if (agentRows.length > 0) {
      // Reading the tick redraws the lines 4 times a second, so each agent's time runs; only while agents run.
      await $.state.get(TICK)
      const now = Date.now()
      for (const row of agentRows.slice(0, MAX_AGENT_LINES)) lines.push([AGENT_MARK, ...fitStatus(agentGroupsOf(row, now), columns - AGENT_MARK.text.length)])
      const more = moreOf(agentRows.length)
      if (more.length > 0) lines.push([AGENT_MARK, ...more])
    }
    // The changed files: one line, a button that opens the panel with the list.
    const changed = changes.length > 0 ? fitStatus(changesGroupsOf(changes as FileChange[], pr.number), columns) : []
    if (lines.length === 0 && changed.length === 0) return theirs
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    // Mobile and the IDE draw no Client: there the branch stays still, in its blue.
    const Client = 'Client' in elements ? elements.Client : undefined
    return (
      <Box flexDirection="column">
        {lines.map(spans => (
          <Box>
            {spans.map(span =>
              span.color === SHIMMER && Client ? (
                <Client key={`shimmer-${waveAt}`} module="./shimmer.tsx" props={{ text: span.text, frames: SHIMMER_FRAMES }} />
              ) : (
                <Text color={span.color === SHIMMER ? 'ide' : span.color || undefined} wrap="truncate">
                  {span.text}
                </Text>
              ),
            )}
          </Box>
        ))}
        {changed.length > 0 && (
          Client ? (
            // Under the pointer it shimmers as the panel's rows do; a click opens the panel.
            <Client key="changes" module="./changes-line.tsx" width="100%" props={{ spans: changed.map(span => ({ text: span.text, color: span.color })) }} />
          ) : (
            <Button key="changes" plain onPress={() => void openChanges($)}>
              {changed.map(span => (
                <Text color={span.color || undefined}>{span.text}</Text>
              ))}
            </Button>
          )
        )}
        {theirs}
      </Box>
    )
  })

  // The changed-files panel: each file with its added and removed lines, as git counts them.
  on('ui.render', { component: 'Pane', requestId: CHANGES_PANE }, async ($, e) => {
    const { value: changes = [] } = await $.state.get(CHANGES)
    const { value: query = '' } = await $.state.get(CHANGES_QUERY)
    const { value: preview = { path: '', root: '', diff: '' } } = await $.state.get(CHANGES_PREVIEW)
    const { value: cursor = '' } = await $.state.get(CHANGES_CURSOR)
    const { value: pr = { number: 0, base: 'HEAD' } } = await $.state.get(CHANGES_PR)
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    // The mobile app draws no field and no code block: there the list shows whole, and a diff as plain text.
    const Input = 'Input' in elements ? elements.Input : undefined
    const Code = 'Code' in elements ? elements.Code : undefined
    const Client = 'Client' in elements ? elements.Client : undefined
    const columns = Math.max(20, e.props.bodyColumns - 2)

    // A file picked: its diff, as filetree previews a file, with a way back and a way out.
    if (preview.path) {
      const change = changes.find(other => other.path === preview.path)
      return (
        <Box flexDirection="column" paddingX={1}>
          <Box flexDirection="row">
            <Button key="back" plain label="← files" hotkey="b" onPress={() => void $.state.set(CHANGES_PREVIEW, { path: '', root: '', diff: '' })} />
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

    const shown = matchesOf(changes, query)
    return (
      <Box flexDirection="column" paddingX={1}>
        {changes.length > 0 ? (
          <Text>
            <Text bold>{titleOf(changes.length, pr.number)}</Text>
            {pr.number > 0 && localOf(changes) && <Text color="warning">{` · ● ${localOf(changes)}`}</Text>}
          </Text>
        ) : (
          <Text bold>No changed files</Text>
        )}
        {/* Typing filters the list; Tab walks the files, the pointer lights the one under it. */}
        {Input && <Input key="search" placeholder="Search files" value={query} autoFocus onInput={value => void $.state.set(CHANGES_QUERY, value)} onSubmit={() => undefined} />}
        {Client ? (
          // The filetree way: a soft background and a shimmer on the row under the pointer.
          // ↑ ↓ walk the engine's focus ring, so each row has a one-cell mark in it; the
          // ui.focus hook hands the list the mark's row, and Enter presses the mark.
          <Box flexDirection="row">
            <Box flexDirection="column" width={2}>
              {shown.map((change, i) => (
                <Button key={`row-${i}`} plain onPress={() => void previewChange($, change.path)}>
                  <Text> </Text>
                </Button>
              ))}
              <Text> </Text>
              <Button key="close-mark" plain onPress={() => void $.ui.close({ id: CHANGES_PANE })}>
                <Text> </Text>
              </Button>
            </Box>
            <Box flexGrow={1}>
              <Client key="files" module="./files-list.tsx" width="100%" props={{ rows: shown.map(change => listRowOf(change, columns - (pr.number > 0 ? 4 : 2))), cursor: cursorOf(cursor, shown.length), isMarked: pr.number > 0 }} />
            </Box>
          </Box>
        ) : (
          <Box key="files" flexDirection="column">
            {shown.map(change => {
              const row = rowOf(change, columns - (pr.number > 0 ? 2 : 0))
              return (
                <Button key={change.path} plain onPress={() => void previewChange($, change.path)}>
                  {pr.number > 0 && <Text color="warning">{change.isLocal ? '● ' : '  '}</Text>}
                  <Text>{row.path}</Text>
                  <Text>{row.gap}</Text>
                  <Text color="success">{change.added > 0 ? `+${change.added}` : ''}</Text>
                  <Text color="error">{change.removed > 0 ? `${change.added > 0 ? ' ' : ''}-${change.removed}` : ''}</Text>
                </Button>
              )
            })}
          </Box>
        )}
        {changes.length > 0 && shown.length === 0 && <Text color="inactive">No file matches</Text>}
        {!Client && (
          <Box marginTop={1}>
            <Button key="close" label="Close" hotkey="c" onPress={() => void $.ui.close({ id: CHANGES_PANE })} />
          </Box>
        )}
      </Box>
    )
  })

  // The arrows, Tab or a click moved the panel's focus ring: the list lights the mark's row.
  on('ui.focus', { component: 'Pane', requestId: CHANGES_PANE }, async ($, e, next) => {
    const result = await next(e)
    if (!result.deny) await $.state.set(CHANGES_CURSOR, e.element ?? '')
    return result
  })

  // The changed-files line clicked: the panel opens.
  on('ui.message', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.element !== 'changes') return next(e)
    await openChanges($)
    return {}
  })

  // A file picked in the list (a second click): the panel previews its diff. Close closes it.
  on('ui.message', async ($, e, next) => {
    if (e.requestId !== CHANGES_PANE || e.element !== 'files') return next(e)
    const { pick, close } = (e.data ?? {}) as { pick?: unknown; close?: unknown }
    if (close === true) await $.ui.close({ id: CHANGES_PANE })
    else if (typeof pick === 'string' && pick) await previewChange($, pick)
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const columns = e.props.bodyColumns
    const { value: at = 0 } = await $.state.get(TICK)
    const { value: hidden = false } = await $.state.get(IS_HIDDEN)
    const isQuiet = !isRobotOn || e.props.hasSurvey || e.props.maxRows < ROWS || hidden
    if (isQuiet) {
      return next(e)
    }

    const { value: percent = 0 } = await $.state.get(CONTEXT_PERCENT)
    const { value: isCompacting = false } = await $.state.get(IS_COMPACTING)
    const { value: celebration } = await $.state.get(CELEBRATION)
    const { value: subagents = 0 } = await $.state.get(SUBAGENTS)
    const isCelebrating = !isCompacting && celebration !== undefined && at - celebration.at < CELEBRATE_TICKS
    const isHot = isFireOn && percent >= hotAt
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

    const track = Math.max(MIN_TRACK, columns - BODY_CELLS)
    // While compacting or celebrating the robot stands still: the factory line runs across the band.
    if (at !== shown.at && !isCompacting && (isNeeded || !isCelebrating)) {
      // Hot: drop everything; walk, then stop and wave its arms (dance), until it cools.
      // Talking (asking for the person, or hot and talking) it dances in place, so its bubble stays put.
      const wanted = isNeeded || (isHot && talkAt(at) >= 0) ? 'dance' : isHot ? 'walk' : undefined
      if (wanted && !(shown.state.state === wanted && shown.state.dur === FOREVER)) {
        shown.state = { ...shown.state, state: wanted, t: 0, dur: FOREVER }
      } else if (!wanted && shown.state.dur === FOREVER) {
        shown.state = { ...shown.state, dur: shown.state.t }
      }
      if (!isHot || isHotStep(at) || !shown.frame) {
        const drawn = step(shown.state, track, randomInt)
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
    let frame: Frame
    if (isCompacting) {
      frame = factory(columns, at - packedFrom, packedSeed)
    } else if (isNeeded) {
      if (!shown.frame) return next(e)
      frame = withFriends(speech(heated(shown.frame, isHot, at), typedSoFar(NEEDS_YOU_SAY, (at - needFrom + 1) * TYPE_SPEED), columns), shown.state.pos, shown.state.dir, columns, friends, subagents, at, isHot ? 'hot' : 'normal', false)
    } else if (isCelebrating && celebration) {
      frame = withFriends(celebrating(shown.state.pos, columns, celebration.act, at - celebration.at), shown.state.pos, shown.state.dir, columns, friends, subagents, at, 'cheer', false)
    } else if (!shown.frame) {
      return next(e)
    } else {
      const robot = isHot && talkAt(at) >= 0
        ? speech(heated(shown.frame, true, at), typedSoFar(sayOf(percent), (talkAt(at) + 1) * TYPE_SPEED), columns)
        : heated(shown.frame, isHot, at)
      // The cat act fills both sides of the robot: the friends stay out of it.
      frame = shown.state.state === 'catpeek'
        ? robot
        : withFriends(robot, shown.state.pos, shown.state.dir, columns, friends, subagents, at, isHot ? 'hot' : 'normal', shown.state.state === 'walk')
    }

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
