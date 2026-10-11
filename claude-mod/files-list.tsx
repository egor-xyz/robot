import type { ClientModule } from 'claude-code'

import { STATUS_COLORS, type ListRow } from './changes'

/** `cursor`: the row the keyboard is on (the engine's focus ring, see register.tsx), or -1. */
export type ListProps = { rows: ListRow[]; cursor: number }
/** The Close row under the files, with one empty row between. */
const CLOSE = 'Close'
type Local = { hover: number; picked: number; phase: number; ref: { props: ListProps; cursor: number; stop?: () => void; light?: (next: Partial<Local>) => void } }

/** One shimmer frame every 60 ms. */
export const FRAME_MS = 60
/** The band's shades, from the row's own color at its edge to the bright middle, as the branch shimmers. */
const SHADES = ['text', 'ide', 'merged', 'claude', 'warning']

/** The colour of letter `i` of a `length`-letter name, `phase` frames into one sweep of the band; `base` away from it. */
export function shadeOf(i: number, phase: number, length: number, base = 'text'): string {
  const away = Math.abs(i - (phase * 1.6 - 5))
  return away < 3.8 ? (SHADES[away < 0.8 ? 4 : away < 1.8 ? 3 : away < 2.8 ? 2 : 1] ?? base) : base
}

/** Frames one sweep takes across a `length`-letter name, edge to edge. */
export const sweepOf = (length: number): number => Math.ceil((length + 10) / 1.6)

/**
 * The changed files, as the filetree mod draws its rows: the row under the
 * pointer (or under the keyboard's cursor) gets a soft background, and its
 * name shimmers once. A click selects a row; a second click posts
 * `{ pick: path, group }` to the hooks; a group's heading is not picked;
 * the Close row under them lights the same way and posts `{ close: true }`.
 */
const FilesList: ClientModule<ListProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (state === undefined) {
    state = { hover: -1, picked: -1, phase: 0, ref: { props, cursor: props.cursor } }
    const ref = state.ref
    // Lights row `at` and runs its shimmer from the start.
    const light = (next: Partial<Local>) => {
      const cur = surface.state
      if (!cur) return
      surface.setState({ ...cur, ...next, phase: 0 })
      ref.stop?.()
      ref.stop = surface.every(FRAME_MS, () => {
        const now = surface.state
        if (!now) return
        const at = now.hover >= 0 ? now.hover : ref.props.cursor >= 0 ? ref.props.cursor : now.picked
        const name = at === ref.props.rows.length + 1 ? CLOSE : ref.props.rows[at]?.name
        if (!name || now.phase >= sweepOf(name.length)) {
          ref.stop?.()
          ref.stop = undefined
          return
        }
        surface.setState({ ...now, phase: now.phase + 1 })
      })
    }
    ref.light = light
    surface.onPointer(e => {
      const cur = surface.state
      if (!cur) return
      const count = ref.props.rows.length
      const at = (e.y >= 0 && e.y < count && !ref.props.rows[e.y]?.heading) || e.y === count + 1 ? e.y : -1
      if (e.type === 'leave') {
        if (cur.hover !== -1) surface.setState({ ...cur, hover: -1 })
        return
      }
      // As filetree: a click selects a file; a click on the selected file, or on Close, acts.
      if (e.type === 'down' && (e.button ?? 'left') === 'left' && at >= 0) {
        if (at === count + 1) void surface.post({ close: true })
        else if (at === cur.picked) void surface.post({ pick: ref.props.rows[at]?.path ?? '', group: ref.props.rows[at]?.group ?? 'local' })
        else light({ picked: at, hover: -1 })
        return
      }
      if (at !== cur.hover) {
        if (at < 0) surface.setState({ ...cur, hover: -1 })
        else light({ hover: at })
      }
    })
    surface.setState(state)
  }
  state.ref.props = props
  // The keyboard moved: light its row and shimmer it, as a hover does.
  const { ref } = state
  if (props.cursor !== ref.cursor) {
    ref.cursor = props.cursor
    if (props.cursor >= 0) void Promise.resolve().then(() => ref.light?.({ hover: -1, picked: -1 }))
  }

  const lit = state.hover >= 0 ? state.hover : props.cursor >= 0 ? props.cursor : state.picked
  return (
    <Box flexDirection="column">
      {props.rows.map((row, i) => {
        if (row.heading) {
          return (
            <Box flexDirection="row" height={1} overflow="hidden">
              <Text bold color="inactive">{row.heading}</Text>
            </Box>
          )
        }
        const isLit = i === lit
        const chars = [...row.name]
        return (
          <Box flexDirection="row" height={1} overflow="hidden" backgroundColor={isLit ? 'subtle' : undefined}>
            {/* As editors list changes: the name, then its folder dim; the counts and the letter at the right edge. */}
            <Box flexShrink={1} overflow="hidden">
              <Text wrap="truncate-start">
                <Text bold>{isLit ? chars.map((char, at) => <Text color={shadeOf(at, state.phase, chars.length)}>{char}</Text>) : row.name}</Text>
                <Text color="inactive">{row.folder ? ` ${row.folder}` : ''}</Text>
              </Text>
            </Box>
            <Box flexGrow={1} />
            <Text color="success">{row.added > 0 ? ` +${row.added}` : ''}</Text>
            <Text color="error">{row.removed > 0 ? ` -${row.removed}` : ''}</Text>
            <Text bold color={STATUS_COLORS[row.status]}>{` ${row.status}`}</Text>
          </Box>
        )
      })}
      <Text> </Text>
      <Box flexDirection="row" height={1}>
        <Text bold>
          {lit === props.rows.length + 1
            ? [...CLOSE].map((char, at) => <Text color={shadeOf(at, state.phase, CLOSE.length)}>{char}</Text>)
            : <Text color="inactive">{CLOSE}</Text>}
        </Text>
      </Box>
    </Box>
  )
}

export default FilesList
