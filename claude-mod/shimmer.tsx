import type { ClientModule } from 'claude-code'

/** What the status line hands the shimmer: the branch name, and how many frames to run (0 runs forever). */
export type ShimmerProps = { text: string; frames: number }
type Local = { phase: number; stop?: () => void }

/** One frame every 90 ms, as smooth as the filetree mod's shimmer. */
export const FRAME_MS = 90

/** The band's shades, from the branch's own blue at its edge to the bright middle. */
const SHADES = ['ide', 'merged', 'bashBorder', 'claude', 'warning']

/**
 * The colour of letter `i` of a `length`-letter name, `phase` frames along: a
 * bright band starts off the left edge, crosses the name, leaves on the right,
 * and starts again (as the filetree mod shimmers a file name).
 */
export function shadeOf(i: number, phase: number, length: number): string {
  const band = ((phase * 1.6) % (length + 10)) - 5
  const away = Math.abs(i - band)
  return SHADES[away < 0.8 ? 4 : away < 1.8 ? 3 : away < 2.8 ? 2 : away < 3.8 ? 1 : 0] ?? 'ide'
}

/** The branch name with the band sweeping over it, on the surface's own fast clock. */
const Shimmer: ClientModule<ShimmerProps, Local> = (props, surface) => {
  const { Text } = surface.elements
  let state = surface.state
  if (state === undefined) {
    state = { phase: 0 }
    state.stop = surface.every(FRAME_MS, () => {
      const cur = surface.state
      if (!cur) return
      const phase = cur.phase + 1
      if (props.frames > 0 && phase >= props.frames) cur.stop?.()
      surface.setState({ ...cur, phase })
    })
    surface.setState(state)
  }
  const chars = [...props.text]
  const isDone = props.frames > 0 && state.phase >= props.frames
  return (
    <Text wrap="truncate">
      {chars.map((char, i) => (
        <Text color={isDone ? 'ide' : shadeOf(i, state.phase, chars.length)}>{char}</Text>
      ))}
    </Text>
  )
}

export default Shimmer
