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
import { accountNameOf, fitStatus, groupsOf, wavedOf } from './statusline'
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
  subagentFriends: true, limitWindows: 'both', limitsAt: 0, needsYou: true, robotSpinner: true, branchWave: true, resetSettings: false,
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
  // Which rate-limit windows the status line shows: both, or one.
  const windowKind = options.limitWindows === '5h' ? 'five_hour' : options.limitWindows === '7d' ? 'seven_day' : undefined
  const windows = windowKind ? [windowKind] : ['seven_day', 'five_hour']

  /** The organisation the person signed in with, read once a session. */
  let account: string | undefined

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    if (options.resetSettings === true) await resetSettings($)
    await $.command.register({ name: 'robot', description: 'Hide or show the robot above the prompt' })

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
      if (!isFriendsOn) return
      try {
        const agents = await $.agent.list()
        const running = agents.filter(agent => ['pending', 'running', 'waiting'].includes(agent.status) && agent.type !== 'teammate').length
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
    return yield* next(e)
  })

  // Claude ended its turn on a question: the robot asks for the person until they send the next prompt.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
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
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
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

  on('command.run', { command: 'robot' }, async $ => {
    const { value: was = false } = await $.state.get(IS_HIDDEN)
    const hidden = !was
    await $.state.set(IS_HIDDEN, hidden)

    return { text: hidden ? 'Robot hidden.' : 'Robot is back.' }
  })

  // The status line: a row of coloured parts above Claude Code's own hint line, which stays as it is.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!isStatusOn) return next(e)
    const { value: status = [] } = await $.state.get(STATUS)
    const theirs = await next(e)
    if (status.length === 0) return theirs
    const { Box, Text } = $.ui.resolve(e)
    // A few cells of room for the line's indent and the right edge.
    let groups = status.filter(group => Array.isArray(group.spans))
    // Only a waving branch reads the tick, so a still line does not redraw 4 times a second.
    const { value: waveAt = -1 } = await $.state.get(WAVE_AT)
    if (isWaveOn && waveAt >= 0) {
      const { value: at = 0 } = await $.state.get(TICK)
      groups = wavedOf(groups, at - waveAt)
    }
    const spans = fitStatus(groups, (e.viewport?.columns ?? 80) - STATUS_MARGIN)
    return (
      <Box flexDirection="column">
        <Box>
          {spans.map(span => (
            <Text color={span.color || undefined} wrap="truncate">
              {span.text}
            </Text>
          ))}
        </Box>
        {theirs}
      </Box>
    )
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
                <Text color={span.color || undefined} wrap="truncate">
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
