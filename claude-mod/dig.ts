import { robotAt, withFriends } from './frames'
import type { Frame, FriendEyes, FriendScene } from './frames'
import type { Friend } from './friends'

/** Cells from the robot's first cell to its excavator's bucket wall, plus the cell before the leftmost friend. */
export const DIG_REACH = 15
/** Most cells the friends creep left out of their slots: in practice all the room up to the robot. */
export const DIG_DRIFT = 200
/** Least creep worth a scene: less room than this and the robot stays out of it. */
export const DIG_MIN_DRIFT = 3

// Ticks per creep cell: the friends roll one cell each tick.
const CREEP_TICKS = 1
// Ticks the robot shakes its fists.
const DIG_ANGRY = 4
// Ticks per morph step: tracks, boom, bucket.
const DIG_MORPH = 2
const MORPH_STEPS = 3
// Ticks the robot stands in its arms-up pose after the push.
const DIG_POP = 6
// Last ticks of the creep, in which the robot notices with wide eyes.
const NOTICE_TICKS = 2
const WALK_COLOR = 208
const ANGRY_COLOR = 196
const POP_COLOR = 213
const NOTICE_COLOR = 214

/** The cells the friends creep for a robot at `x` and a leftmost friend slot at `left`: 0 when there is no room. */
export function digDriftOf(x: number, left: number): number {
  const room = left - x - DIG_REACH
  return room < DIG_MIN_DRIFT ? 0 : Math.min(DIG_DRIFT, room)
}

// Cells the excavator drives before the bucket reaches the creeping friends.
const driveOf = (x: number, left: number, drift: number): number => Math.max(0, left - x - DIG_REACH - drift)

// First tick of each phase, in ticks from the start.
function phasesOf(x: number, left: number, drift: number) {
  const angry = CREEP_TICKS * drift
  const morph = angry + DIG_ANGRY
  const drive = morph + DIG_MORPH * MORPH_STEPS
  const push = drive + driveOf(x, left, drift)
  const pop = push + drift
  return { angry, morph, drive, push, pop, end: pop + DIG_POP }
}

/** Ticks the whole scene takes. */
export function digDurOf(x: number, left: number, drift: number): number {
  return phasesOf(x, left, drift).end
}

/** The robot's first cell at tick `t`: still through creep, fists and morph, driving, pushing, then at its last spot, `left - DIG_REACH`. */
export function digXOf(x: number, left: number, drift: number, t: number): number {
  const p = phasesOf(x, left, drift)
  const room = driveOf(x, left, drift) + drift
  if (t < p.drive) return x
  if (t < p.push) return x + 1 + (t - p.drive)
  if (t < p.pop) return x + (room - drift) + 1 + (t - p.push)
  return x + room
}

const ANGRY_ROWS = (isFist: boolean): string[] => ['  .\\---/.', '  [o   o]', isFist ? '  o|━━━|o' : '  /|━━━|\\', '   o   o']
const TRACKS = ['(o=o=o=o)', '(=o=o=o=)'] as const
// The excavator, built a part at a time: tracks, then the boom, then the bucket.
function diggerRows(step: number, tick: number): string[] {
  const tracks = TRACKS[tick % 2] ?? TRACKS[0]
  const rows = ['  .\\---/.', '  [o   o]', '  /|━━━|\\', `  ${tracks}`]
  if (step >= 2) {
    rows[1] += '━━━┓'
    rows[2] = '  /|━━━|    ┃'
  }
  if (step >= 3) rows[3] += ' └─┘'
  return rows
}

/**
 * The excavator scene, `t` ticks in, for a robot that starts at `x` and friends whose leftmost slot is `left`, drawn with
 * the friends at `tick` (`drift` from digDriftOf). The friends creep left out of their slots toward the robot; it goes
 * wide-eyed, then angry, and turns into an excavator part by part (tracks, boom, bucket). It drives up and pushes them
 * back to their slots, bucket always touching the leftmost, then pops back into the robot with its arms up.
 */
export function digFrameOf(x: number, left: number, drift: number, t: number, columns: number, friends: readonly Friend[], count: number, tick: number): Frame {
  const p = phasesOf(x, left, drift)
  const at = digXOf(x, left, drift, t)
  const scene = (drifted: number, eyes: FriendEyes, rolling: boolean): FriendScene => ({ drift: drifted, eyes, rolling })
  const play = (rows: readonly string[], accent: number, s: FriendScene): Frame => withFriends(robotAt(rows, at, accent), columns, friends, count, tick, 'normal', s)

  if (t < p.angry) {
    const isNoticing = t >= p.angry - NOTICE_TICKS
    const drifted = Math.min(drift, Math.floor(t / CREEP_TICKS) + 1)
    const rows = ['  .-----.', isNoticing ? '  [O   O]' : '  [o   o]', '  /|━━━|\\', '   o   o']
    return play(rows, isNoticing ? NOTICE_COLOR : WALK_COLOR, scene(drifted, 'curious', t % 2 === 0))
  }
  if (t < p.morph) return play(ANGRY_ROWS((t - p.angry) % 2 === 0), ANGRY_COLOR, scene(drift, 'wide', false))
  if (t < p.drive) return play(diggerRows(1 + Math.floor((t - p.morph) / DIG_MORPH), t), ANGRY_COLOR, scene(drift, 'wide', false))
  if (t < p.push) return play(diggerRows(3, t), ANGRY_COLOR, scene(drift, 'wide', false))
  if (t < p.pop) return play(diggerRows(3, t), ANGRY_COLOR, scene(drift - 1 - (t - p.push), 'wide', true))
  return play([' \\.-----./', '  [^   ^]', '   |━━━|', '   o   o'], POP_COLOR, scene(0, 'blink', false))
}
