import { expect, test } from 'claude-code/testing'

import { meterOf, tightestLimit } from './usage'

test('no readings, no limit', () => {
  expect(tightestLimit([])).toBeNull()
})

test('the fuller limit wins', () => {
  expect(
    tightestLimit([
      { kind: 'five_hour', percentUsed: 40 },
      { kind: 'seven_day', percentUsed: 81 },
    ]),
  ).toEqual({ kind: 'seven_day', percent: 81 })
})

test('a tie prefers five_hour, then seven_day, then the first seen', () => {
  expect(
    tightestLimit([
      { kind: 'seven_day', percentUsed: 50 },
      { kind: 'five_hour', percentUsed: 50 },
    ])?.kind,
  ).toBe('five_hour')
  expect(
    tightestLimit([
      { kind: 'spend_limit', percentUsed: 50 },
      { kind: 'seven_day', percentUsed: 50 },
    ])?.kind,
  ).toBe('seven_day')
  expect(
    tightestLimit([
      { kind: 'a', percentUsed: 50 },
      { kind: 'b', percentUsed: 50 },
    ])?.kind,
  ).toBe('a')
})

test('the percent is rounded', () => {
  expect(tightestLimit([{ kind: 'five_hour', percentUsed: 23.5 }])?.percent).toBe(24)
})

test('NaN readings are ignored', () => {
  expect(tightestLimit([{ kind: 'five_hour', percentUsed: Number.NaN }])).toBeNull()
  expect(
    tightestLimit([
      { kind: 'five_hour', percentUsed: Number.NaN },
      { kind: 'seven_day', percentUsed: 10 },
    ]),
  ).toEqual({ kind: 'seven_day', percent: 10 })
})

test('the meter reads label, five-cell bar and percent', () => {
  expect(meterOf({ kind: 'seven_day', percent: 23 })).toBe('7d ━━─── 23%')
  expect(meterOf({ kind: 'five_hour', percent: 0 })).toBe('5h ───── 0%')
  expect(meterOf({ kind: 'five_hour', percent: 1 })).toBe('5h ━──── 1%')
  expect(meterOf({ kind: 'five_hour', percent: 21 })).toBe('5h ━━─── 21%')
  expect(meterOf({ kind: 'five_hour', percent: 100 })).toBe('5h ━━━━━ 100%')
})

test('a reading over 100 shows 100%, and an unknown window a neutral label', () => {
  expect(meterOf({ kind: 'spend_limit', percent: 140 })).toBe('$$ ━━━━━ 100%')
  expect(meterOf({ kind: 'monthly', percent: 50 })).toBe('·· ━━━── 50%')
})
