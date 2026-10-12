import { expect, test } from 'claude-code/testing'

import type { StepUsage } from './agents'
import { isColdAt, learnedTtlOf, ttlOf } from './cache'

const MIN = 60_000
const usage = (read: number, written = 0, fresh = 0): StepUsage => ({ input_tokens: fresh, output_tokens: 10, cache_read_input_tokens: read, cache_creation_input_tokens: written })

test('cold needs a request, and the full TTL gone', () => {
  expect(isColdAt(0, 10 * MIN, '5m')).toBe(false)
  expect(isColdAt(1000, 1000 + 5 * MIN - 1, '5m')).toBe(false)
  expect(isColdAt(1000, 1000 + 5 * MIN, '5m')).toBe(true)
  expect(isColdAt(1000, 1000 + 30 * MIN, '1h')).toBe(false)
  expect(isColdAt(1000, 1000 + 60 * MIN, '1h')).toBe(true)
})

test('a set TTL beats the learned one; auto and garbage fall back to learned, then 5m', () => {
  expect(ttlOf('1h', '5m')).toBe('1h')
  expect(ttlOf('5m', '1h')).toBe('5m')
  for (const setting of ['auto', undefined, 7]) expect(ttlOf(setting, '1h')).toBe('1h')
  expect(ttlOf('auto', undefined)).toBe('5m')
  expect(ttlOf(undefined, 'junk')).toBe('5m')
})

test('a cache read after a long break proves the 1-hour cache', () => {
  expect(learnedTtlOf(6 * MIN, usage(90_000, 5_000, 5_000))).toBe('1h')
  expect(learnedTtlOf(6 * MIN, usage(50, 50))).toBe('1h')
  expect(learnedTtlOf(6 * MIN, usage(0, 100_000))).toBeUndefined()
  expect(learnedTtlOf(6 * MIN, usage(10_000, 90_000))).toBeUndefined()
})

test('learning needs a break past 5m plus the margin and under 1h', () => {
  expect(learnedTtlOf(4 * MIN, usage(90_000))).toBeUndefined()
  expect(learnedTtlOf(5 * MIN + 30_000, usage(90_000))).toBeUndefined()
  expect(learnedTtlOf(5 * MIN + 30_001, usage(90_000))).toBe('1h')
  expect(learnedTtlOf(60 * MIN, usage(90_000))).toBeUndefined()
  expect(learnedTtlOf(90 * MIN, usage(90_000))).toBeUndefined()
})
