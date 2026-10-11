import { expect, test } from 'claude-code/testing'

import { meterOf } from './usage'

test('the meter reads label and percent', () => {
  expect(meterOf({ kind: 'seven_day', percent: 23 })).toBe('7d 23%')
  expect(meterOf({ kind: 'five_hour', percent: 0 })).toBe('5h 0%')
  expect(meterOf({ kind: 'five_hour', percent: 100 })).toBe('5h 100%')
})

test('a reading over 100 shows 100%, and an unknown window a neutral label', () => {
  expect(meterOf({ kind: 'spend_limit', percent: 140 })).toBe('$$ 100%')
  expect(meterOf({ kind: 'monthly', percent: 50 })).toBe('·· 50%')
})
