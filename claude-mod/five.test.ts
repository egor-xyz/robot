import { expect, test } from 'claude-code/testing'

import { FIVE_REACH, fiveDurOf, fiveFrameOf, fiveXOf } from './five'
import { cellsOf, friendSlotOf } from './frames'
import type { Friend } from './friends'

const COLUMNS = 80
const still = (id: number): Friend => ({ id, lag: 0, leaving: false })
const THREE = [still(1), still(2), still(3)]
const LEFT = friendSlotOf(COLUMNS, THREE.length - 1, THREE.length)
const X = LEFT - FIVE_REACH - 12
const DUR = fiveDurOf(X, LEFT)
const APPROACH = DUR - 10
const frame = (t: number, tick = 1, friends = THREE) =>
  fiveFrameOf(X, LEFT, t, COLUMNS, friends, friends.length, friends.at(-1)?.id ?? 0, tick).map(row => row.map(span => span.text).join(''))

test('the scene lasts the approach plus ten ticks, and starts without a jump', () => {
  expect(fiveXOf(X, LEFT, 0)).toBe(X)
  expect(APPROACH).toBe(11)
})

test('the robot never moves left and steps at most one cell a tick', () => {
  for (let t = 1; t < DUR; t++) {
    const step = fiveXOf(X, LEFT, t) - fiveXOf(X, LEFT, t - 1)
    expect(step === 0 || step === 1).toBe(true)
  }
  expect(fiveXOf(X, LEFT, DUR - 1)).toBe(LEFT - FIVE_REACH)
})

test('the slap frame matches the art, 3 friends in 80 columns', () => {
  const rows = frame(APPROACH + 2, 1)
  const xs = LEFT - FIVE_REACH
  const cut = (row: string) => row.slice(xs).trimEnd()

  expect(cut(rows[0] ?? '')).toBe('  .-----.\\oo✨')
  expect(cut(rows[1] ?? '').slice(0, 19)).toBe('  [^   ^]   \\(^)(^)')
  expect(cut(rows[2] ?? '').slice(0, 8)).toBe('   |━━━|')
  expect(rows[0]?.slice(xs + 10, xs + 12)).toBe('oo')
  expect(rows[2]?.slice(LEFT, LEFT + 6)).toBe(' [##]=')
})

test('on the raise ticks one blank cell separates the two hands', () => {
  for (const t of [APPROACH, APPROACH + 1]) {
    const row = frame(t)[0] ?? ''
    const robotHand = row.indexOf('\\o') + 1
    expect(row.slice(robotHand, robotHand + 3)).toBe('o o')
  }
})

test('the spark shows on the first slap tick only', () => {
  const sparks = Array.from({ length: DUR }, (_, t) => (frame(t).join('').includes('✨') ? t : -1)).filter(t => t >= 0)

  expect(sparks).toEqual([APPROACH + 2])
})

test('no row passes the band and the robot never overlaps a friend', () => {
  for (let t = 0; t < DUR; t++) {
    for (const tick of [t, t + 1]) {
      const rows = frame(t, tick)
      expect(rows.every(row => cellsOf(row) <= COLUMNS)).toBe(true)
      // Every friend is still drawn whole: three treads rows' worth of eyes.
      expect(rows.join('\n').match(/\[##\]/g)?.length).toBe(THREE.length)
    }
  }
})

test('only the leftmost friend raises an arm', () => {
  const rows = frame(APPROACH + 2)

  expect(rows[0]?.match(/o/g)?.length).toBe(2)
  expect(rows[1]?.match(/\\/g)?.length).toBe(1)
  expect(rows[2]?.match(/ \[##\]=/g)?.length).toBe(1)
  expect(rows[2]?.match(/=\[##\]=/g)?.length).toBe(2)
})

test('in the cheer the friends hop on even ticks and wear happy eyes', () => {
  const even = frame(DUR - 1, 4)
  const odd = frame(DUR - 1, 5)

  expect(even[0]).toContain('(^)(^)')
  expect(even[3]?.slice(LEFT - 3).trim()).toBe('')
  expect(odd[1]).toContain('(^)(^)')
  expect(odd[3]).toContain('(oooo)')
})

test('the friends turn curious on the last four approach ticks only', () => {
  expect(frame(APPROACH - 5)[1]).toContain('(o)(o)')
  expect(frame(APPROACH - 4)[1]).toContain('(O)(o)')
  expect(frame(APPROACH - 1)[1]).toContain('(O)(o)')
  expect(frame(APPROACH)[1]).toContain('(O)(O)')
})

test('a short approach still plays, and the friends are not mutated', () => {
  const near = LEFT - FIVE_REACH - 2
  const copy = JSON.stringify(THREE)
  const dur = fiveDurOf(near, LEFT)

  expect(dur).toBe(11)
  for (let t = 0; t < dur; t++) fiveFrameOf(near, LEFT, t, COLUMNS, THREE, 3, 3, t)
  expect(JSON.stringify(THREE)).toBe(copy)
})
