import { robotAt, withFriends } from './frames'
import type { Frame, FriendEyes, FriendScene } from './frames'
import type { Friend } from './friends'

/** Cells between the robot's pad and the friend's first cell when the hands slap. */
export const FIVE_REACH = 13
// Ticks the robot and the friend raise a hand, slap, and cheer with both arms up.
const FIVE_RAISE = 2
const FIVE_SLAP = 2
const FIVE_CHEER = 6
// Ticks before the raise the friends turn curious.
const FIVE_CURIOUS = 4

const WALK = [
  ['  .-----.', '  [o   o]', '  /|━━━|\\', '   o   o'],
  ['  .-----.', '  [o   o]', '  /|━━━|\\', '   O   O'],
] as const
// Column 11 stays blank for the friend's hand; the spark takes columns 12-13.
const RAISED = ['  .-----.\\o', '  [o   o]', '   |━━━|', '   o   o']
const SLAPPED = ['  .-----.\\o ✨', '  [^   ^]', '   |━━━|', '   o   o']
const HELD = ['  .-----.\\o', '  [^   ^]', '   |━━━|', '   o   o']
const CHEERED = ['\\o.-----.o/', '  [^   ^]', '   |━━━|', '   o   o']

/** Ticks the robot walks to its spot, one cell each (at least 1). */
const approachOf = (x: number, left: number): number => Math.max(1, left - FIVE_REACH - 1 - x)

/** Ticks the whole scene takes for a robot at `x` and the leftmost friend's slot at `left`. */
export function fiveDurOf(x: number, left: number): number {
  return approachOf(x, left) + FIVE_RAISE + FIVE_SLAP + FIVE_CHEER
}

/** Where the robot stands (its pad) `t` ticks into the scene: it walks right one cell a tick, then stays at the spot. */
export function fiveXOf(x: number, left: number, t: number): number {
  const approach = approachOf(x, left)
  if (t < approach) return x + Math.max(0, t)
  return x + approach + (t >= approach + FIVE_RAISE ? 1 : 0)
}

/** One frame of the high five: the robot walks up, both raise a hand, slap with a spark, and everyone cheers. */
export function fiveFrameOf(x: number, left: number, t: number, columns: number, friends: readonly Friend[], count: number, friendId: number, tick: number): Frame {
  const approach = approachOf(x, left)
  const at = fiveXOf(x, left, t)
  const slap = approach + FIVE_RAISE
  const cheer = slap + FIVE_SLAP
  const look = (eyes: FriendEyes): FriendScene => ({ drift: 0, eyes, rolling: false, armUp: friendId })

  if (t < approach) {
    const eyes: FriendEyes = t >= approach - FIVE_CURIOUS ? 'curious' : 'normal'
    return withFriends(robotAt(WALK[Math.max(0, t) % 2] ?? WALK[0], at, 208), columns, friends, count, tick, 'normal', { drift: 0, eyes, rolling: false })
  }
  if (t < slap) return withFriends(robotAt(RAISED, at, 213), columns, friends, count, tick, 'normal', look('wide'))
  if (t < cheer) {
    const rows = t === slap ? SLAPPED : HELD
    return withFriends(robotAt(rows, at, 213), columns, friends, count, tick, 'normal', look('happy'))
  }
  return withFriends(robotAt(CHEERED, at, 213), columns, friends, count, tick, 'cheer', { drift: 0, eyes: 'happy', rolling: false })
}
