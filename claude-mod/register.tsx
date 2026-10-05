import type { Register } from 'claude-code'

import { CELL_WIDTH, ROW_HEIGHT, heated, speech, svgOf } from './frames'
import type { Frame } from './frames'
import { INITIAL, randomInt, step } from './robot'
import type { RobotState } from './robot'

const TICK_MS = 250
const ROWS = 4
// The robot body is ten cells wide; keep it whole at the right edge.
const BODY_CELLS = 10
const MIN_TRACK = 12
const HEAT_MS = 2000
// Context usage (percent) at which the head turns red and catches fire.
const HOT_AT = 25
// An animation that never ends by itself: how the robot is held walking or dancing while hot.
const FOREVER = Number.MAX_SAFE_INTEGER
// Hot pace: in each cycle of ticks it walks for HOT_WALK ticks, then stops, waves its arms and talks.
const HOT_CYCLE = 48
const HOT_WALK = 16

/** A hot robot moves every other tick, slower than usual; its fire still moves every tick. */
const isHotStep = (at: number): boolean => at % 2 === 0
/** Whether a hot robot is in its stop, when it waves its arms and talks. */
const isHotStop = (at: number): boolean => at % HOT_CYCLE >= HOT_WALK
// Letters typed per tick while it talks.
const TYPE_SPEED = 2

/** The lines as typed so far in this stop, letter by letter across the lines, padded so they never shift. */
function typed(lines: string[], at: number): string[] {
  let left = ((at % HOT_CYCLE) - HOT_WALK + 1) * TYPE_SPEED
  return lines.map(line => {
    const chars = [...line]
    const shown = chars.slice(0, Math.max(0, left)).join('')
    left -= chars.length
    return shown + ' '.repeat(chars.length - [...shown].length)
  })
}

// Plain $.state calls: older engines refuse $ passed into imported helpers.
const TICK = { plugin: 'robot', key: 'tick' } as const
const IS_HIDDEN = { plugin: 'robot', key: 'isHidden' } as const
const CONTEXT_PERCENT = { plugin: 'robot', key: 'contextPercent' } as const

/** The robot as of the last tick drawn: its state, which tick, and that tick's frame. */
const shown: { state: RobotState; at: number; frame: Frame | undefined } = { state: INITIAL, at: -1, frame: undefined }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'robot', description: 'Hide or show the robot above the prompt' })

    $.clock.every(TICK_MS, async () => {
      const { value: hidden = false } = await $.state.get(IS_HIDDEN)
      if (hidden) return
      const { value: at = 0 } = await $.state.get(TICK)
      await $.state.set(TICK, at + 1)
    })

    $.clock.every(HEAT_MS, async () => {
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
    const isHot = percent >= HOT_AT

    const track = Math.max(MIN_TRACK, columns - BODY_CELLS)
    if (at !== shown.at) {
      // Hot: drop everything; walk, then stop and wave its arms (dance), until it cools.
      const wanted = isHotStop(at) ? 'dance' : 'walk'
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
    const frame = isHot && isHotStop(at) ? speech(burning, typed([`context ${percent}%`, '/compact me!'], at), columns) : burning

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
