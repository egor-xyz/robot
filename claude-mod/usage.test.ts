import { expect, test } from 'claude-code/testing'

import { DEFAULT_COLOR, cellsOf, hexOf } from './frames'
import type { Frame, Span } from './frames'
import { GAUGE_CELLS, gaugeOf, tightestLimit, withGauge } from './usage'

const join = (spans: Span[]) => spans.map(span => span.text).join('')
const cellsIn = (row: Span[]) => cellsOf(join(row))
const barOf = (kind: string, percent: number) => gaugeOf({ kind, percent }).filter(span => /^[━─]+$/.test(span.text))

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

for (const percent of [0, 1, 20, 21, 62, 100, 140]) {
  test(`the gauge is 14 cells at ${percent}%`, () => {
    expect(GAUGE_CELLS).toBe(14)
    expect(cellsOf(join(gaugeOf({ kind: 'five_hour', percent })))).toBe(14)
  })
}

for (const [kind, label] of [
  ['five_hour', '5h'],
  ['seven_day', '7d'],
  ['spend_limit', '$$'],
  ['mystery', '··'],
] as const) {
  test(`${kind} is labelled ${label}`, () => {
    const text = join(gaugeOf({ kind, percent: 10 }))
    expect(text.startsWith(` ${label} `)).toBe(true)
    expect(cellsOf(text)).toBe(14)
  })
}

for (const [percent, filled] of [
  [0, 0],
  [1, 1],
  [20, 1],
  [21, 2],
  [100, 5],
] as const) {
  test(`${percent}% fills ${filled} bars`, () => {
    const text = join(gaugeOf({ kind: 'five_hour', percent }))
    expect(text.split('━').length - 1).toBe(filled)
    expect(text.split('─').length - 1).toBe(5 - filled)
  })
}

for (const [percent, index] of [
  [49, 114],
  [50, 220],
  [79, 220],
  [80, 203],
] as const) {
  test(`${percent}% colours the bar with index ${index}`, () => {
    const [filled] = barOf('five_hour', percent)
    expect(filled?.text.startsWith('━')).toBe(true)
    expect(filled?.color).toBe(hexOf(index))
  })
}

test('empty bars are dim and an empty bar is not a span', () => {
  expect(barOf('five_hour', 0)).toEqual([{ text: '─────', color: hexOf(240) }])
  expect(barOf('five_hour', 100)).toEqual([{ text: '━━━━━', color: hexOf(203) }])
})

test('a reading over 100 shows 100%', () => {
  expect(join(gaugeOf({ kind: 'spend_limit', percent: 140 })).endsWith('100%')).toBe(true)
})

test('the percent is right-aligned in the default colour', () => {
  const spans = gaugeOf({ kind: 'five_hour', percent: 7 })
  expect(join(spans).endsWith('  7%')).toBe(true)
  expect(spans.at(-1)?.color).toBe(DEFAULT_COLOR)
})

const gauge = gaugeOf({ kind: 'five_hour', percent: 62 })
const frame: Frame = [
  [{ text: 'ab', color: '#111111' }],
  [{ text: 'row one', color: '#222222' }],
  [{ text: 'row two', color: '#333333' }],
]

test('a short first row is padded to the layout before the gauge', () => {
  const out = withGauge(frame, 6, gauge)
  expect(cellsIn(out[0] ?? [])).toBe(6 + 14)
  expect(join(out[0] ?? []).startsWith('ab    ')).toBe(true)
})

test('a long first row is cut to the layout', () => {
  const long: Frame = [[{ text: 'abcdefghij', color: '#111111' }]]
  const out = withGauge(long, 4, gauge)
  expect(cellsIn(out[0] ?? [])).toBe(4 + 14)
  expect(join(out[0] ?? []).startsWith('abcd ')).toBe(true)
})

test('an emoji on the edge becomes one space', () => {
  const edge: Frame = [[{ text: 'abc🤖def', color: '#111111' }]]
  const out = withGauge(edge, 4, gauge)
  expect(join(out[0] ?? []).startsWith('abc ')).toBe(true)
  expect(join(out[0] ?? []).includes('🤖')).toBe(false)
  expect(cellsIn(out[0] ?? [])).toBe(4 + 14)
})

test('an emoji that fits stays', () => {
  const fits: Frame = [[{ text: 'ab🤖def', color: '#111111' }]]
  const out = withGauge(fits, 4, gauge)
  expect(join(out[0] ?? []).startsWith('ab🤖')).toBe(true)
  expect(cellsIn(out[0] ?? [])).toBe(4 + 14)
})

test('other rows are unchanged and the input is not mutated', () => {
  const before = structuredClone(frame)
  const out = withGauge(frame, 6, gauge)
  expect(out.slice(1)).toEqual(frame.slice(1))
  expect(frame).toEqual(before)
})

test('an empty frame becomes the padded gauge row', () => {
  const out = withGauge([], 5, gauge)
  expect(out).toHaveLength(1)
  expect(out[0]).toEqual([{ text: '     ', color: DEFAULT_COLOR }, ...gauge])
})
