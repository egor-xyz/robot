import { expect, test } from 'claude-code/testing'

import type { Frame } from './frames'
import { FRAME_SEPARATOR, CELL_WIDTH, cellsOf, framesOf, hexOf, heated, spansOf, svgOf } from './frames'

test('a row splits into coloured spans without escape codes', () => {
  const row = '\x1b[38;5;208m  [\x1b[38;5;213m^   ^\x1b[38;5;208m]\x1b[39m\x1b[K'

  expect(spansOf(row)).toEqual([
    { text: '  [', color: '#ff8700' },
    { text: '^   ^', color: '#ff87ff' },
    { text: ']', color: '#ff8700' },
  ])
})

test('the generator output splits into four-row frames', () => {
  const frame = 'a\x1b[K\nb\x1b[K\nc\x1b[K\nd\x1b[K\n'
  const frames = framesOf(`${frame}${FRAME_SEPARATOR}${frame}${FRAME_SEPARATOR}`)

  expect(frames.length).toBe(2)
  expect(frames[0]?.map(row => row.map(span => span.text).join(''))).toEqual(['a', 'b', 'c', 'd'])
})

test('emoji take two cells', () => {
  expect(cellsOf('o🏀')).toBe(3)
})

test('greys and the colour cube map to hex', () => {
  expect(hexOf(208)).toBe('#ff8700')
  expect(hexOf(244)).toBe('#808080')
})

test('the SVG is one fixed-grid drawing in the span colours, emoji taking two cells', () => {
  const svg = svgOf([[{ text: '<🏀x', color: '#ff8700' }, { text: ' y', color: '#ff87ff' }], [], [], []], 20)

  expect(svg.match(/<svg/g)?.length).toBe(1)
  expect(svg).toContain('&lt;')
  expect(svg).toContain('fill="#ff8700"')
  expect(svg).toContain('fill="#ff87ff"')
  const xOf = (char: string) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${char}</text>`).exec(svg)?.[1])
  expect(Math.round(xOf('x') - xOf('🏀'))).toBe(Math.round(2 * CELL_WIDTH))
  expect(Math.round(xOf('y') - xOf('x'))).toBe(Math.round(2 * CELL_WIDTH))
})

const HEAD: Frame = [
  [{ text: '  .-----.', color: '#ff8700' }],
  [{ text: '  [', color: '#ff8700' }, { text: 'o   o', color: '#ff87ff' }, { text: ']', color: '#ff8700' }],
  [{ text: '  /|---|\\', color: '#ff8700' }],
  [{ text: '   o   o', color: '#ff8700' }],
]
const textOf = (row: Frame[number]) => row.map(span => span.text).join('')

test('a cool head is left as it was', () => {
  expect(heated(HEAD, false)).toEqual(HEAD)
})

test('a hot head turns its orange head rows red and keeps other colours and rows', () => {
  const out = heated(HEAD, true)

  expect(out[1]?.map(span => span.color)).toEqual([hexOf(196), '#ff87ff', hexOf(196)])
  expect(out[2]).toEqual(HEAD[2])
  expect(out[3]).toEqual(HEAD[3])
})

test('a hot head swaps the head top for flames of the same width', () => {
  const out = heated(HEAD, true)
  const top = textOf(out[0] ?? [])

  expect(top).not.toContain('.-----.')
  expect(cellsOf(top)).toBe(cellsOf(textOf(HEAD[0] ?? [])))
  expect(top.startsWith('  ')).toBe(true)
  expect(new Set(out[0]?.map(span => span.color))).toEqual(new Set([hexOf(208), hexOf(226), hexOf(196)]))
  expect(out.slice(1).map(textOf)).toEqual(HEAD.slice(1).map(textOf))
})
