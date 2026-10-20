import { expect, test } from 'claude-code/testing'

import { digDurOf, digXOf } from './dig'
import { fiveDurOf, fiveXOf } from './five'
import { friendSlotOf, isFriendsAtRest } from './frames'
import type { Friend } from './friends'
import { MEET_GAP, MEET_ODDS, areSettled, isMeetOn, meetFrameOf, meetOf, meetXOf } from './meet'

const friendsOf = (count: number): Friend[] => Array.from({ length: count }, (_, id) => ({ id, lag: 0, leaving: false }))
const rolls = (...values: number[]): (() => number) => {
  let next = 0
  return () => values[next++ % values.length] ?? 0
}

// 60 columns, 3 friends: left = 35. x = 5 fits both kinds; x = 19 fits only the five (room 1); x = 25 fits neither.
const COLUMNS = 60
const COUNT = 3
const LEFT = friendSlotOf(COLUMNS, COUNT - 1, COUNT)
const FRIENDS = friendsOf(COUNT)
const SINCE = 100
// The first tick past the gap where the friends rest.
const REST_AT = Array.from({ length: 20 }, (_, i) => SINCE + MEET_GAP + i).find(isFriendsAtRest) ?? SINCE + MEET_GAP
const MOVING_AT = Array.from({ length: 20 }, (_, i) => SINCE + MEET_GAP + i).find(tick => !isFriendsAtRest(tick)) ?? 0
const WIN = 0
const FIVE = 1
const DIG = 3

test('no meet before the gap, with unsettled friends, off rest, or when nothing fits', () => {
  expect(meetOf(SINCE + MEET_GAP - 1, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, FIVE))).toBeUndefined()
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, FIVE))?.kind).toBe('five')
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, [], COUNT, rolls(WIN, FIVE))).toBeUndefined()
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, [{ id: 0, lag: 2, leaving: false }], 1, rolls(WIN, FIVE))).toBeUndefined()
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, [{ id: 0, lag: 0, leaving: true }], 1, rolls(WIN, FIVE))).toBeUndefined()
  expect(meetOf(MOVING_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, FIVE))).toBeUndefined()
  expect(meetOf(REST_AT, SINCE, 25, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, FIVE))).toBeUndefined()
  expect(meetOf(REST_AT, SINCE, 0, 1, 100, FRIENDS, COUNT, rolls(WIN, FIVE))).toBeUndefined()
})

test('only a draw of 0 in MEET_ODDS starts a meet', () => {
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(0, FIVE))).toBeDefined()
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(MEET_ODDS, FIVE))).toBeDefined()
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(1, FIVE))).toBeUndefined()
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(MEET_ODDS - 1, FIVE))).toBeUndefined()
})

test('a kind draw of 0 in 3 is the dig; an unfit kind gives way to the other', () => {
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, DIG))?.kind).toBe('dig')
  expect(meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, FIVE))?.kind).toBe('five')
  // Dig drawn, but the friends have no room to creep: the five plays.
  expect(meetOf(REST_AT, SINCE, 19, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, DIG))?.kind).toBe('five')
  // Five drawn, but the robot walks left: the dig plays.
  expect(meetOf(REST_AT, SINCE, 5, -1, COLUMNS, FRIENDS, COUNT, rolls(WIN, FIVE))?.kind).toBe('dig')
})

test('the meet records the start, the slot, the creep and the leftmost friend', () => {
  const five = meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, FIVE))
  expect(five).toEqual({ kind: 'five', from: REST_AT, x: 5, left: LEFT, drift: 0, friendId: FRIENDS.at(-1)?.id, columns: COLUMNS, count: COUNT })
  const dig = meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, DIG))
  expect(dig?.drift).toBeGreaterThan(0)
  expect(dig?.friendId).toBe(2)
})

test('areSettled needs at least one friend, all in place', () => {
  expect(areSettled([])).toBe(false)
  expect(areSettled(FRIENDS)).toBe(true)
  expect(areSettled([...FRIENDS, { id: 9, lag: 1, leaving: false }])).toBe(false)
  expect(areSettled([...FRIENDS, { id: 9, lag: 0, leaving: true }])).toBe(false)
})

test('isMeetOn ends with the scene time or a change of band, count, friends or leftmost', () => {
  for (const kind of [FIVE, DIG]) {
    const meet = meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, kind))
    if (!meet) throw new Error('no meet')
    const dur = meet.kind === 'five' ? fiveDurOf(meet.x, meet.left) : digDurOf(meet.x, meet.left, meet.drift)
    expect(isMeetOn(meet, meet.from, COLUMNS, FRIENDS, COUNT)).toBe(true)
    expect(isMeetOn(meet, meet.from + dur - 1, COLUMNS, FRIENDS, COUNT)).toBe(true)
    expect(isMeetOn(meet, meet.from + dur, COLUMNS, FRIENDS, COUNT)).toBe(false)
    expect(isMeetOn(meet, meet.from + 1, COLUMNS + 1, FRIENDS, COUNT)).toBe(false)
    expect(isMeetOn(meet, meet.from + 1, COLUMNS, FRIENDS, COUNT + 1)).toBe(false)
    expect(isMeetOn(meet, meet.from + 1, COLUMNS, [...FRIENDS, { id: 9, lag: 0, leaving: false }], COUNT)).toBe(false)
    expect(isMeetOn(meet, meet.from + 1, COLUMNS, [{ id: 0, lag: 0, leaving: false }, { id: 1, lag: 0, leaving: false }, { id: 2, lag: 0, leaving: true }], COUNT)).toBe(false)
    expect(isMeetOn(meet, meet.from + 1, COLUMNS, [{ id: 5, lag: 0, leaving: false }, ...FRIENDS.slice(1)], COUNT)).toBe(true)
    expect(isMeetOn(meet, meet.from + 1, COLUMNS, [...FRIENDS.slice(0, 2), { id: 7, lag: 0, leaving: false }], COUNT)).toBe(false)
  }
})

test('meetXOf starts at x, ends at the scene end x, and is clamped outside the scene', () => {
  const five = meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, FIVE))
  const dig = meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, DIG))
  if (!five || !dig) throw new Error('no meet')
  const fiveDur = fiveDurOf(5, LEFT)
  expect(meetXOf(five, five.from)).toBe(5)
  expect(meetXOf(five, five.from + fiveDur - 1)).toBe(fiveXOf(5, LEFT, fiveDur - 1))
  expect(meetXOf(five, five.from + fiveDur + 50)).toBe(LEFT - 13)
  expect(meetXOf(five, five.from - 5)).toBe(5)
  const digDur = digDurOf(5, LEFT, dig.drift)
  expect(meetXOf(dig, dig.from)).toBe(5)
  expect(meetXOf(dig, dig.from + digDur - 1)).toBe(digXOf(5, LEFT, dig.drift, digDur - 1))
  expect(meetXOf(dig, dig.from + digDur + 50)).toBe(LEFT - 15)
})

test('meetFrameOf draws four rows in the band for the whole scene, either kind', () => {
  for (const kind of [FIVE, DIG]) {
    const meet = meetOf(REST_AT, SINCE, 5, 1, COLUMNS, FRIENDS, COUNT, rolls(WIN, kind))
    if (!meet) throw new Error('no meet')
    const dur = meet.kind === 'five' ? fiveDurOf(meet.x, meet.left) : digDurOf(meet.x, meet.left, meet.drift)
    for (let t = 0; t < dur; t++) {
      const frame = meetFrameOf(meet, meet.from + t, FRIENDS)
      expect(frame.length).toBe(4)
      expect(frame.some(row => row.some(span => span.text.trim() !== ''))).toBe(true)
    }
  }
})
