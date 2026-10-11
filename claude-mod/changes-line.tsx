import type { ClientModule } from 'claude-code'

import { FRAME_MS, shadeOf, sweepOf } from './files-list'

/** The line under the status line, span by span: `8 files changed`, ` | `, `+505`, … */
export type LineProps = { spans: { text: string; color: string }[] }
type Local = { isHover: boolean; phase: number; ref: { props: LineProps; stop?: () => void } }

/**
 * The changed-files line, drawn as the panel draws its rows: under the
 * pointer it gets a soft background and a band shimmers across it once.
 * A click posts `{ open: true }` to the hooks, which open the panel.
 */
const ChangesLine: ClientModule<LineProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (state === undefined) {
    state = { isHover: false, phase: 0, ref: { props } }
    const ref = state.ref
    surface.onPointer(e => {
      const cur = surface.state
      if (!cur) return
      if (e.type === 'down' && (e.button ?? 'left') === 'left') {
        void surface.post({ open: true })
        return
      }
      const isHover = e.type !== 'leave'
      if (isHover === cur.isHover) return
      surface.setState({ ...cur, isHover, phase: 0 })
      ref.stop?.()
      ref.stop = undefined
      if (!isHover) return
      const length = ref.props.spans.reduce((sum, span) => sum + [...span.text].length, 0)
      ref.stop = surface.every(FRAME_MS, () => {
        const now = surface.state
        if (!now) return
        if (now.phase >= sweepOf(length)) {
          ref.stop?.()
          ref.stop = undefined
          return
        }
        surface.setState({ ...now, phase: now.phase + 1 })
      })
    })
    surface.setState(state)
  }
  state.ref.props = props

  const { isHover, phase } = state
  const length = props.spans.reduce((sum, span) => sum + [...span.text].length, 0)
  let at = 0
  return (
    <Box flexDirection="row" height={1} overflow="hidden" backgroundColor={isHover ? 'subtle' : undefined}>
      <Text wrap="truncate">
        {props.spans.map(span =>
          [...span.text].map(char => <Text color={isHover ? shadeOf(at++, phase, length, span.color) || undefined : span.color || undefined}>{char}</Text>),
        )}
      </Text>
    </Box>
  )
}

export default ChangesLine
