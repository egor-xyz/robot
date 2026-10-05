import type { Register } from 'claude-code'

import { CELL_WIDTH, ROW_HEIGHT, heated, svgOf } from './frames'
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

// Plain $.state calls: older engines refuse $ passed into imported helpers.
const TICK = { plugin: 'robot', key: 'tick' } as const
const IS_HIDDEN = { plugin: 'robot', key: 'isHidden' } as const
const IS_HOT = { plugin: 'robot', key: 'isHot' } as const

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
        const isHot = (context.percent ?? 0) >= HOT_AT
        const { value: was = false } = await $.state.get(IS_HOT)
        if (isHot !== was) await $.state.set(IS_HOT, isHot)
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

    const track = Math.max(MIN_TRACK, columns - BODY_CELLS)
    if (at !== shown.at) {
      const drawn = step(shown.state, track, randomInt)
      shown.state = drawn.state
      shown.frame = drawn.frame
      shown.at = at
    }
    if (!shown.frame) return next(e)
    const { value: isHot = false } = await $.state.get(IS_HOT)
    const frame = heated(shown.frame, isHot)

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
                <Text color={span.color} wrap="truncate">
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
