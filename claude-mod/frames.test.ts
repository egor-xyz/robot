import { expect, test } from 'claude-code/testing'

import type { Frame } from './frames'
import { FRAME_SEPARATOR, CELL_WIDTH, cellsOf, framesOf, hexOf, heated, spansOf, speech, svgOf } from './frames'

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
  expect(heated(HEAD, false, 0)).toEqual(HEAD)
})

test('a hot head turns its orange head rows red and keeps other rows', () => {
  const out = heated(HEAD, true, 0)

  expect(out[1]?.[0]?.color).toBe(hexOf(196))
  expect(out[2]).toEqual(HEAD[2])
  expect(out[3]).toEqual(HEAD[3])
})

test('the head top cycles through four flame steps of the same width, corners kept', () => {
  const tops = [0, 1, 2, 3].map(tick => textOf(heated(HEAD, true, tick)[0] ?? []))
  const width = cellsOf(textOf(HEAD[0] ?? []))

  expect(new Set(tops).size).toBe(4)
  for (const top of tops) {
    expect(cellsOf(top)).toBe(width)
    expect(top).toContain('🔥')
    expect(top.trimEnd().endsWith('.')).toBe(true)
  }
  expect(textOf(heated(HEAD, true, 4)[0] ?? [])).toBe(tops[0])
})

test('sparks only replace spaces and never move the head', () => {
  for (const tick of [0, 1, 2, 3]) {
    const top = textOf(heated(HEAD, true, tick)[0] ?? [])
    const original = textOf(HEAD[0] ?? [])
    const at = original.indexOf('.-----.')

    const head = [...top].slice(at, at + 7).join('')

    expect(head).toMatch(/^\.[-🔥 ]+\.$/u)
    expect(cellsOf(top)).toBe(cellsOf(original))
  }
  const sparked = [0, 1, 2, 3].map(tick => textOf(heated(HEAD, true, tick)[0] ?? []).slice(0, 2))
  expect(new Set(sparked).size).toBeGreaterThan(1)
})

test('a hot face alternates its eyes by tick and keeps its width', () => {
  const even = textOf(heated(HEAD, true, 0)[1] ?? [])
  const odd = textOf(heated(HEAD, true, 1)[1] ?? [])

  expect(even).toBe('  [O   O]')
  expect(odd).toBe('  [>   <]')
  expect(cellsOf(even)).toBe(cellsOf(textOf(HEAD[1] ?? [])))
})

const SAY = 'context 31% · /compact me!'

test('speech goes to the right of the robot when it fits', () => {
  const out = speech(HEAD, SAY, 60)

  expect(textOf(out[1] ?? [])).toBe(`  [o   o] < ${SAY}`)
  expect(out[1]?.at(-1)?.color).toBe(hexOf(196))
  expect(out.filter((_, i) => i !== 1)).toEqual(HEAD.filter((_, i) => i !== 1))
})

test('speech falls back to the left of the robot', () => {
  const shifted: Frame = HEAD.map(row => [{ text: ' '.repeat(40), color: '#ff8700' }, ...row])
  const out = speech(shifted, SAY, 52)
  const row = textOf(out[1] ?? [])

  expect(row).toContain(`${SAY} > `)
  expect(row.trimStart().startsWith('context')).toBe(true)
  expect(row.endsWith('[o   o]')).toBe(true)
  expect(cellsOf(row)).toBe(cellsOf(textOf(shifted[1] ?? [])))
})

test('speech is skipped when it fits on neither side', () => {
  expect(speech(HEAD, SAY, 30)).toEqual(HEAD)
})
