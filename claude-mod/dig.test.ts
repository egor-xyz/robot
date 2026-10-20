import { expect, test } from 'claude-code/testing'

import { DIG_DRIFT, DIG_MIN_DRIFT, DIG_REACH, digDriftOf, digDurOf, digFrameOf, digXOf } from './dig'
import { cellsOf, friendSlotOf } from './frames'
import type { Frame } from './frames'
import type { Friend } from './friends'

const textOf = (frame: Frame): string[] => frame.map(row => row.map(span => span.text).join(''))
const friendsOf = (count: number): Friend[] => Array.from({ length: count }, (_, id) => ({ id, lag: 0, leaving: false }))

// x = 2, three friends in 60 columns: left = 60 + 2 - 27 = 35, room = 35 - 2 - 15 = 18, drift 18 (all the room), drive 0.
const COLUMNS = 60
const COUNT = 3
const X = 2
const LEFT = friendSlotOf(COLUMNS, COUNT - 1, COUNT)
const DRIFT = digDriftOf(X, LEFT)
const DUR = digDurOf(X, LEFT, DRIFT)
const FRIENDS = friendsOf(COUNT)
const frameAt = (t: number): string[] => textOf(digFrameOf(X, LEFT, DRIFT, t, COLUMNS, FRIENDS, COUNT, t))
const ticks = Array.from({ length: DUR }, (_, t) => t)
// The first tick of each phase for this geometry: creep D, angry 4, morph 6, drive V, push D, pop 6.
const ANGRY_AT = DRIFT
const DRIVE_AT = ANGRY_AT + 4 + 6
const PUSH_AT = DRIVE_AT + (LEFT - X - DIG_REACH - DRIFT)

test('the friends creep only as far as there is room, at most DIG_DRIFT', () => {
  expect(digDriftOf(0, 15 + DIG_MIN_DRIFT - 1)).toBe(0)
  expect(digDriftOf(0, 15 + DIG_MIN_DRIFT)).toBe(DIG_MIN_DRIFT)
  expect(digDriftOf(0, 15 + 5)).toBe(5)
  expect(digDriftOf(0, 15 + DIG_DRIFT + 50)).toBe(DIG_DRIFT)
  expect(digDriftOf(30, 40)).toBe(0)
})

test('the excavator starts where the robot stood and ends at left - DIG_REACH, one cell at a time', () => {
  expect(digXOf(X, LEFT, DRIFT, 0)).toBe(X)
  expect(digXOf(X, LEFT, DRIFT, DUR - 1)).toBe(LEFT - DIG_REACH)
  ticks.slice(1).forEach(t => {
    const step = digXOf(X, LEFT, DRIFT, t) - digXOf(X, LEFT, DRIFT, t - 1)
    expect(step === 0 || step === 1).toBe(true)
  })
})

test('the head top stays at x + 2 through creep, angry and morph', () => {
  ticks.filter(t => t < DRIVE_AT).forEach(t => {
    expect(frameAt(t)[0]?.indexOf('.')).toBe(X + 2)
  })
})

test('the creep reaches the full drift and never passes it', () => {
  const treadsAt = (t: number): number => (frameAt(t)[3] ?? '').indexOf('(', LEFT - DRIFT - 1)
  expect(treadsAt(0)).toBe(LEFT - 1)
  expect(treadsAt(ANGRY_AT - 1)).toBe(LEFT - DRIFT)
  ticks.filter(t => t < PUSH_AT).forEach(t => {
    expect(treadsAt(t) >= LEFT - DRIFT).toBe(true)
  })
})

test('during the push the bucket wall touches the leftmost friend and the friends end in their slots', () => {
  ticks.filter(t => t >= PUSH_AT && t < PUSH_AT + DRIFT).forEach(t => {
    const row = frameAt(t)[3] ?? ''
    const wall = row.indexOf('┘')
    expect(wall).toBeGreaterThan(0)
    expect(row.slice(wall + 1, wall + 7).replace(/O/g, 'o')).toBe('(oooo)')
  })
  const last = frameAt(DUR - 1)[3] ?? ''
  expect([...Array(COUNT).keys()].every(rank => last.slice(friendSlotOf(COLUMNS, rank, COUNT), friendSlotOf(COLUMNS, rank, COUNT) + 6) === '(oooo)')).toBe(true)
})

test('the push frame matches the art', () => {
  // x = 3, left = 28 (two friends in 44 columns): drift 10 (all the room), drive 0; the first push tick.
  const columns = 44
  const left = friendSlotOf(columns, 1, 2)
  const drift = digDriftOf(3, left)
  const at = drift + 4 + 6 + (left - 3 - DIG_REACH - drift)
  const rows = textOf(digFrameOf(3, left, drift, at, columns, friendsOf(2), 2, 1))
  const ex = digXOf(3, left, drift, at)

  expect(rows.map(row => row.slice(ex).trimEnd())).toEqual([
    '  .\\---/.',
    '  [o   o]━━━┓  (O)(O)   (O)(O)',
    '  /|━━━|    ┃  =[##]=   =[##]=',
    '  (o=o=o=o) └─┘(OOOO)   (OOOO)',
  ])
})

test('the robot turns angry, then builds tracks, boom and bucket in that order', () => {
  expect(frameAt(ANGRY_AT)[0]).toContain('.\\---/.')
  expect(frameAt(ANGRY_AT)[2]).toContain('o|━━━|o')
  expect(frameAt(ANGRY_AT + 1)[2]).toContain('/|━━━|\\')
  expect(frameAt(ANGRY_AT + 4)[3]).toContain('(o=o=o=o)')
  expect(frameAt(ANGRY_AT + 4)[1]).not.toContain('┓')
  expect(frameAt(ANGRY_AT + 6)[1]).toContain('━━━┓')
  expect(frameAt(ANGRY_AT + 6)[3]).not.toContain('└')
  expect(frameAt(ANGRY_AT + 8)[3]).toContain('└─┘')
})

test('the pop is the robot with its arms up and no excavator parts', () => {
  const robot = frameAt(DUR - 1).map(row => row.slice(0, LEFT - 1))
  expect(robot.join('')).not.toMatch(/[┓┃└┘─=]/)
  expect(robot[0]).toContain('\\.-----./')
  expect(robot[1]).toContain('[^   ^]')
})

test('nothing passes the columns and every friend stays drawn at every tick', () => {
  ticks.forEach(t => {
    const rows = frameAt(t)
    rows.forEach(row => expect(cellsOf(row) <= COLUMNS).toBe(true))
    expect((rows[2]?.match(/=\[##\]=/g) ?? []).length).toBe(COUNT)
  })
})
