import { DIG_REACH, digDriftOf, digDurOf, digFrameOf, digXOf } from './dig'
import { FIVE_REACH, fiveDurOf, fiveFrameOf, fiveXOf } from './five'
import { friendSlotOf, isFriendsAtRest } from './frames'
import type { Frame } from './frames'
import type { Friend } from './friends'

/** The two visits: the robot walks over for a high five, or the friends creep up and it digs them back. */
export type MeetKind = 'five' | 'dig'
/** A visit in play: where the robot started (`x`), the leftmost friend's slot (`left`), and the friends' creep (`drift`, dig only). */
export type Meet = { kind: MeetKind; from: number; x: number; left: number; drift: number; friendId: number; columns: number; count: number }

/** Ticks the friends must have been settled (and since the last visit) before one can start: 60 s. */
export const MEET_GAP = 240
/** One in this many eligible ticks starts a visit. */
export const MEET_ODDS = 160
/** The most cells of walking or driving a visit may need. */
export const MEET_REACH = 32
/** Ticks of the walk that takes the robot out after a visit. */
export const MEET_WALK_AWAY = 16
// One in this many visits is the dig: half as likely as the five.
const DIG_ONE_IN = 3

/** True when there is at least one friend and every one waits in its slot: none rolls in or out. */
export const areSettled = (friends: readonly Friend[]): boolean => friends.length > 0 && friends.every(friend => friend.lag === 0 && !friend.leaving)

const durOf = (meet: Meet): number => (meet.kind === 'five' ? fiveDurOf(meet.x, meet.left) : digDurOf(meet.x, meet.left, meet.drift))

/**
 * A visit that starts at tick `at`, or undefined. The friends must have been settled since `since` for MEET_GAP ticks and
 * be at rest in their shuffle, and a kind must fit around the robot at `x` going `dir`. Then one draw in MEET_ODDS wins,
 * and one in three of those is the dig (the other kind plays when the picked one does not fit).
 */
export function meetOf(at: number, since: number, x: number, dir: 1 | -1, columns: number, friends: readonly Friend[], count: number, random: () => number): Meet | undefined {
  const lead = friends.at(-1)
  if (!lead || !areSettled(friends) || at - since < MEET_GAP || !isFriendsAtRest(at)) return undefined
  const left = friendSlotOf(columns, friends.length - 1, count)
  const reach = left - FIVE_REACH - x
  const drift = digDriftOf(x, left)
  const canFive = dir === 1 && reach >= 2 && reach <= MEET_REACH
  const canDig = drift > 0 && left - x - DIG_REACH <= MEET_REACH
  if (!canFive && !canDig) return undefined
  if (random() % MEET_ODDS !== 0) return undefined
  const isDig = random() % DIG_ONE_IN === 0 ? canDig : !canFive
  return { kind: isDig ? 'dig' : 'five', from: at, x, left, drift: isDig ? drift : 0, friendId: lead.id, columns, count }
}

/** True while the visit plays: its time is not up and the friends and the band are as it started (same width, count, all settled, same leftmost). */
export function isMeetOn(meet: Meet, at: number, columns: number, friends: readonly Friend[], count: number): boolean {
  return at - meet.from < durOf(meet) && columns === meet.columns && count === meet.count && areSettled(friends) && friends.at(-1)?.id === meet.friendId
}

// The visit's own tick at `at`, held inside its first and last tick.
const tOf = (meet: Meet, at: number): number => Math.min(Math.max(at - meet.from, 0), durOf(meet) - 1)

/** The robot's first cell at tick `at` of the visit; before the start it is `x`, after the end the last spot. */
export function meetXOf(meet: Meet, at: number): number {
  const t = tOf(meet, at)
  return meet.kind === 'five' ? fiveXOf(meet.x, meet.left, t) : digXOf(meet.x, meet.left, meet.drift, t)
}

/** One frame of the visit at tick `at`, robot and friends. */
export function meetFrameOf(meet: Meet, at: number, friends: readonly Friend[]): Frame {
  const t = tOf(meet, at)
  return meet.kind === 'five'
    ? fiveFrameOf(meet.x, meet.left, t, meet.columns, friends, meet.count, meet.friendId, at)
    : digFrameOf(meet.x, meet.left, meet.drift, t, meet.columns, friends, meet.count, at)
}
