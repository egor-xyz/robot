import { expect, test } from 'claude-code/testing'

import type { Frame, Span } from './frames'
import { FRAME_SEPARATOR, CELL_WIDTH, celebrating, cellsOf, framesOf, hexOf, heated, spansOf, packing, packStage, PACK_STAGES, speech, svgOf, typedSoFar, withFriends, COMMAND_COLOR, DEFAULT_COLOR } from './frames'

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

const SAY_TEXT = ['context 31%', '/compact me!']
const SAY: Span[][] = [
  [{ text: 'context 31%', color: DEFAULT_COLOR }],
  [{ text: '/compact', color: COMMAND_COLOR }, { text: ' me!', color: DEFAULT_COLOR }],
]

test('speech goes to the right of the robot in two lines, four cells out, in the default colour', () => {
  const out = speech(HEAD, SAY, 60)

  expect(textOf(out[1] ?? [])).toBe(`  [o   o]    ${SAY_TEXT[0]}`)
  expect(textOf(out[2] ?? [])).toBe(`  /|---|\\    ${SAY_TEXT[1]}`)
  expect(out[1]?.at(-1)?.color).toBe(DEFAULT_COLOR)
  expect(out[0]).toEqual(HEAD[0])
  expect(out[3]).toEqual(HEAD[3])
})

test('speech falls back to the left of the robot', () => {
  const shifted: Frame = HEAD.map(row => [{ text: ' '.repeat(40), color: '#ff8700' }, ...row])
  const out = speech(shifted, SAY, 52)
  const eyes = textOf(out[1] ?? [])

  expect(eyes.trimStart().startsWith('context 31%')).toBe(true)
  expect(eyes.endsWith('[o   o]')).toBe(true)
  expect(textOf(out[2] ?? []).trimStart().startsWith('/compact me!')).toBe(true)
  expect(cellsOf(eyes)).toBe(cellsOf(textOf(shifted[1] ?? [])))
})

test('speech is skipped when it fits on neither side', () => {
  expect(speech(HEAD, SAY, 20)).toEqual(HEAD)
})

test('/compact is drawn in the command colour', () => {
  const out = speech(HEAD, SAY, 60)

  expect(out[2]?.find(span => span.text === '/compact')?.color).toBe(COMMAND_COLOR)
})

test('typing reveals letters in order across the lines and keeps their width', () => {
  const typed = typedSoFar(SAY, 13)

  expect(typed.map(textOf)).toEqual(['context 31%', '/c          '])
  expect(typed[1]?.[0]?.color).toBe(COMMAND_COLOR)
})

test('the robot packs itself into a box part by part, then the closed box shakes', () => {
  const rows = (stage: number, tick = 0) => packing(2, 60, stage, tick).map(textOf)

  expect(rows(0)[3]).toContain('o   o')
  expect(rows(0)[3]).toContain('└───────┘')
  expect(rows(1)[3]?.trim()).toBe('└───────┘')
  expect(rows(1)[2]).toContain('│ o   o │')
  expect(rows(2)[2]?.trim()).toBe('│o|━━━|o│')
  expect(rows(3)[1]?.trim()).toBe('│[^   ^]│')
  const closed = rows(PACK_STAGES - 1)
  expect(closed[0]?.trim()).toBe('┌───────┐')
  expect(closed.join('')).not.toContain('[')
  expect(rows(PACK_STAGES - 1, 1)[0]).not.toBe(closed[0])
  expect(rows(PACK_STAGES + 3)).toEqual(closed)
})

test('the box goes left of the robot when the right side is too narrow', () => {
  const rows = packing(30, 40, 0, 0).map(textOf)

  expect(rows[3]?.indexOf('└')).toBe(21)
  expect(rows[3]?.indexOf('o')).toBeGreaterThan(30)
})

test('packing loops while the compaction runs: in, closed, out, again', () => {
  const stages = Array.from({ length: 20 }, (_, steps) => packStage(steps))

  expect(stages.slice(0, 5)).toEqual([0, 1, 2, 3, PACK_STAGES - 1])
  expect(stages.slice(10)).toEqual(stages.slice(0, 10))
  for (const [i, stage] of stages.entries()) expect(Math.abs(stage - (stages[i + 1] ?? 0))).toBeLessThanOrEqual(1)
})

const rowsOf = (frame: Frame) => frame.map(textOf)

test('a commit raises both arms and stamps a ✅ beside the robot with "committed!"', () => {
  const rows = rowsOf(celebrating(2, 60, 'commit', 0))

  expect(rows[0]).toContain('\\o.-----.o/')
  expect(rows.join('\n')).toContain('✅')
  expect(rows[1]).toContain('committed!')
  expect(rows[1]?.indexOf('✅')).toBeGreaterThan(rows[1]?.indexOf(']') ?? 99)
})

test('the ✅ bounces between two rows as the ticks pass', () => {
  const rowOfStamp = (t: number) => rowsOf(celebrating(2, 60, 'commit', t)).findIndex(row => row.includes('✅'))

  expect(rowOfStamp(0)).not.toBe(rowOfStamp(1))
  expect(rowOfStamp(2)).toBe(rowOfStamp(0))
})

test('a push waves an arm and its 🚀 rises one row every three ticks, with "pushed!"', () => {
  const rowOfRocket = (t: number) => rowsOf(celebrating(2, 60, 'push', t)).findIndex(row => row.includes('🚀'))

  expect([0, 3, 6, 9, 12].map(rowOfRocket)).toEqual([3, 2, 1, 0, 0])
  expect(rowOfRocket(2)).toBe(rowOfRocket(0))
  expect(rowsOf(celebrating(2, 60, 'push', 0))[1]).toContain('pushed!')
  expect(rowsOf(celebrating(2, 60, 'push', 0))[0]).not.toBe(rowsOf(celebrating(2, 60, 'push', 1))[0])
})

test('the cheer goes to the left of the robot near the right edge', () => {
  const rows = rowsOf(celebrating(40, 56, 'commit', 0))

  expect(rows[1]?.indexOf('committed!')).toBeLessThan(rows[1]?.indexOf('[') ?? 0)
  expect(rows[1]?.indexOf('✅')).toBeLessThan(rows[1]?.indexOf('[') ?? 0)
})

test('a celebration never passes the columns', () => {
  for (const act of ['commit', 'push'] as const) {
    for (const [x, columns] of [[0, 60], [30, 60], [40, 56], [45, 56]] as const) {
      for (let t = 0; t < 12; t++) {
        for (const row of celebrating(x, columns, act, t)) expect(cellsOf(textOf(row))).toBeLessThanOrEqual(columns)
      }
    }
  }
})

const standing = (x: number): Frame =>
  ['  .-----.', '  [o   o]', '  /|━━━|\\', '   o   o'].map(raw => [{ text: ' '.repeat(x) + raw, color: DEFAULT_COLOR }])
const robotsIn = (frame: Frame) => (rowsOf(frame)[3]?.match(/🤖/g) ?? []).length

test('no running subagents leaves the frame as it was', () => {
  const frame = standing(20)

  expect(withFriends(frame, 20, 1, 60, 0, 1)).toBe(frame)
})

test('friends stand left of the robot when it walks right, and right of it when it walks left', () => {
  const right = rowsOf(withFriends(standing(20), 20, 1, 60, 2, 1))
  expect(robotsIn(withFriends(standing(20), 20, 1, 60, 2, 1))).toBe(2)
  expect(right[3]?.lastIndexOf('🤖')).toBeLessThan(right[3]?.indexOf('o') ?? 0)
  expect(right[2]).not.toContain('×')

  const left = rowsOf(withFriends(standing(20), 20, -1, 60, 2, 1))
  expect(robotsIn(withFriends(standing(20), 20, -1, 60, 2, 1))).toBe(2)
  expect(left[3]?.indexOf('🤖')).toBeGreaterThan(left[3]?.lastIndexOf('o') ?? 99)
  expect(left[2]).not.toContain('×')
})

test('seven subagents still draw three robots, and only then a label counts all seven', () => {
  for (const dir of [1, -1] as const) {
    const frame = withFriends(standing(20), 20, dir, 60, 7, 1)

    expect(robotsIn(frame)).toBe(3)
    expect(rowsOf(frame)[2]).toContain('×7')
  }
})

test('friends never move to the front: near the back edge fewer or none are drawn', () => {
  const some = withFriends(standing(5), 5, 1, 60, 3, 1)
  expect(robotsIn(some)).toBeGreaterThan(0)
  expect(robotsIn(some)).toBeLessThan(3)
  expect(rowsOf(some)[3]?.lastIndexOf('🤖')).toBeLessThan(5)

  expect(rowsOf(withFriends(standing(2), 2, 1, 60, 2, 1))).toEqual(rowsOf(standing(2)))
  expect(rowsOf(withFriends(standing(46), 46, -1, 56, 2, 1))).toEqual(rowsOf(standing(46)))
})

test('friends never pass the columns', () => {
  for (const [x, columns] of [[0, 60], [2, 60], [20, 60], [40, 56], [45, 56], [2, 30]] as const) {
    for (const dir of [1, -1] as const) {
      for (const count of [1, 3, 7, 12]) {
        for (const row of withFriends(standing(x), x, dir, columns, count, 0)) expect(cellsOf(textOf(row))).toBeLessThanOrEqual(columns)
      }
    }
  }
})
