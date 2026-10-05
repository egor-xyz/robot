import type { EngineInterface, Register } from 'claude-code'

import type { Frame } from './frames'
import { filmOf } from './robot'

const FRAME_COUNT = 1200
const TICK_MS = 250
const ROWS = 4
// The robot body is ten cells wide; keep it whole at the right edge.
const BODY_CELLS = 10
const MIN_TRACK = 12

// Plain $.state calls: older engines refuse $ passed into imported helpers.
const TICK = { plugin: 'robot', key: 'tick' } as const
const IS_HIDDEN = { plugin: 'robot', key: 'isHidden' } as const

/** The frames on loop and the track they were drawn for. */
const film: { frames: Frame[]; track: number } = { frames: [], track: 0 }

/** Draws a fresh frame set when the band is a new width. */
function generate(columns: number): void {
  const wanted = Math.max(MIN_TRACK, columns - BODY_CELLS)
  if (wanted === film.track) return
  film.frames = filmOf(wanted, FRAME_COUNT)
  film.track = wanted
}

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
    generate(columns)

    const { value: at = 0 } = await $.state.get(TICK)
    const { value: hidden = false } = await $.state.get(IS_HIDDEN)
    const frame = film.frames[at % film.frames.length]
    const isQuiet = e.props.hasSurvey || e.props.maxRows < ROWS || !frame || hidden
    if (isQuiet) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

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
