import type { EngineInterface, Register } from 'claude-code'

import { FRAME_SEPARATOR, framesOf } from './frames'
import type { Frame } from './frames'

const FRAME_COUNT = 1200
const TICK_MS = 250
const ROWS = 4
// The robot body is ten cells wide; keep it whole at the right edge.
const BODY_CELLS = 10
const MIN_TRACK = 12

// Plain $.state calls: older engines refuse $ passed into imported helpers.
const TICK = { plugin: 'robot', key: 'tick' } as const
const IS_HIDDEN = { plugin: 'robot', key: 'isHidden' } as const

/**
 * The zsh that runs this repo's own functions/crazy-robot and records every
 * frame; $1 is the functions folder, $2 the track width.
 */
const GENERATOR = `fpath=($1 $fpath); autoload -Uz crazy-robot
typeset _robot_state=walk _robot_t=0 _robot_dur=6 _robot_pos=0 _robot_dir=1 _robot_mirror=0 _robot_f _robot_s _robot_locked=0
for i in {1..${FRAME_COUNT}}; do crazy-robot $2; print -rn -- $'${FRAME_SEPARATOR}'; done`

/** The frames on loop, the track they were drawn for, and a track being drawn. */
const film: { frames: Frame[]; track: number; pending: number } = { frames: [], track: 0, pending: 0 }

/** Renders a fresh frame set for a band this many cells wide. */
async function generate($: EngineInterface, columns: number): Promise<void> {
  const wanted = Math.max(MIN_TRACK, columns - BODY_CELLS)
  if (wanted === film.track || wanted === film.pending) return
  film.pending = wanted
  const { exitCode, stdout, stderr } = await $.process.run([
    'zsh',
    '-fc',
    GENERATOR,
    'robot',
    `${$.plugin.root}/functions`,
    String(wanted),
  ])
  if (film.pending !== wanted) return
  film.pending = 0
  if (exitCode !== 0) {
    $.ui.log(`robot: frame generator failed: ${stderr.slice(0, 200)}`, { to: 'debug' })
    return
  }
  film.frames = framesOf(stdout)
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
    void generate($, columns)

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
