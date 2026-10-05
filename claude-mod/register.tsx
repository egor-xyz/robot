import type { Register } from 'claude-code'

import { CELL_WIDTH, COMMAND_COLOR, DEFAULT_COLOR, ROW_HEIGHT, heated, speech, svgOf, typedSoFar } from './frames'
import type { Frame, Span } from './frames'
import { INITIAL, randomInt, step } from './robot'
import type { RobotState } from './robot'

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


// Plain $.state calls: older engines refuse $ passed into imported helpers.
const TICK = { plugin: 'robot', key: 'tick' } as const
const IS_HIDDEN = { plugin: 'robot', key: 'isHidden' } as const
const CONTEXT_PERCENT = { plugin: 'robot', key: 'contextPercent' } as const

/** The robot as of the last tick drawn: its state, which tick, and that tick's frame. */
const shown: { state: RobotState; at: number; frame: Frame | undefined } = { state: INITIAL, at: -1, frame: undefined }

export const register: Register = (on, options) => {
  const hotAt = typeof options.hotAt === 'number' && options.hotAt > 0 ? options.hotAt : HOT_AT
  // The `contextFire` option turns the whole context-on-fire act off; on unless set to false.
  const isFireOn = options.contextFire !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'robot', description: 'Hide or show the robot above the prompt' })

    $.clock.every(TICK_MS, async () => {
      const { value: hidden = false } = await $.state.get(IS_HIDDEN)
      if (hidden) return
      const { value: at = 0 } = await $.state.get(TICK)
      await $.state.set(TICK, at + 1)
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

    return started
  })

  on('command.run', { command: 'robot' }, async $ => {
    const { value: was = false } = await $.state.get(IS_HIDDEN)
    const hidden = !was
    await $.state.set(IS_HIDDEN, hidden)

    return { text: hidden ? 'Robot hidden.' : 'Robot is back.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const columns = e.props.bodyColumns
    const { value: at = 0 } = await $.state.get(TICK)
    const { value: hidden = false } = await $.state.get(IS_HIDDEN)
    const isQuiet = e.props.hasSurvey || e.props.maxRows < ROWS || hidden
    if (isQuiet) {
      return next(e)
    }

    const { value: percent = 0 } = await $.state.get(CONTEXT_PERCENT)
    const isHot = isFireOn && percent >= hotAt

    const track = Math.max(MIN_TRACK, columns - BODY_CELLS)
    if (at !== shown.at) {
      // Hot: drop everything; walk, then stop and wave its arms (dance), until it cools.
      const wanted = talkAt(at) >= 0 ? 'dance' : 'walk'
      if (isHot && !(shown.state.state === wanted && shown.state.dur === FOREVER)) {
        shown.state = { ...shown.state, state: wanted, t: 0, dur: FOREVER }
      } else if (!isHot && shown.state.dur === FOREVER) {
        shown.state = { ...shown.state, dur: shown.state.t }
      }
      if (!isHot || isHotStep(at) || !shown.frame) {
        const drawn = step(shown.state, track, randomInt)
        shown.state = drawn.state
        shown.frame = drawn.frame
      }
      shown.at = at
    }
    if (!shown.frame) return next(e)
    const burning = heated(shown.frame, isHot, at)
    const frame = isHot && talkAt(at) >= 0 ? speech(burning, typedSoFar(sayOf(percent), (talkAt(at) + 1) * TYPE_SPEED), columns) : burning

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
