import { expect, test } from 'claude-code/testing'

import type { Frame, FriendMood, Span } from './frames'
import type { Friend } from './friends'
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
const still = (id: number, lag = 0): Friend => ({ id, lag, leaving: false })
const roll = (frame: Frame, friends: Friend[], tick: number, mood: FriendMood = 'normal', isWalking = false, x = 20, dir: 1 | -1 = 1, count = friends.length, columns = 60) =>
  rowsOf(withFriends(frame, x, dir, columns, friends, count, tick, mood, isWalking))
/** A tick where friend 0 neither blinks nor looks around nor stretches. */
const CALM = 6

test('no friends leaves the frame as it was', () => {
  const frame = standing(20)

  expect(withFriends(frame, 20, 1, 60, [], 0, 1, 'normal', false)).toBe(frame)
})

test('a friend is six cells of ASCII robot: eyes, body, treads', () => {
  const rows = roll(standing(20), [still(1)], CALM)

  expect(rows[1]).toContain('(o)(o)')
  expect(rows[2]).toContain('=[##]=')
  expect(rows[3]).toContain('(oooo)')
  for (const row of rows) expect(row).toMatch(/^[\x20-\x7e━]*$/)
  expect(rows[2]?.indexOf('=[##]=')).toBe(rows[1]?.indexOf('(o)(o)'))
})

test('friends are coloured: ochre body, grey treads, default eyes', () => {
  const frame = withFriends(standing(20), 20, 1, 60, [still(1)], 1, CALM, 'normal', false)
  const colorOf = (row: number, text: string) => {
    let at = 0
    for (const span of frame[row] ?? []) {
      const found = span.text.indexOf(text)
      if (found >= 0 && cellsOf(span.text.slice(0, found)) + at === textOf(frame[row] ?? []).indexOf(text)) return span.color
      at += cellsOf(span.text)
    }
    return undefined
  }

  expect(colorOf(1, '(o)(o)')).toBe(DEFAULT_COLOR)
  expect(colorOf(2, '=[##]=')).toBe(hexOf(178))
  expect(colorOf(3, '(oooo)')).toBe(hexOf(244))
})

test('treads roll only when the friend moves or the robot walks', () => {
  const treads = (friends: Friend[], isWalking: boolean, tick: number) => roll(standing(20), friends, tick, 'normal', isWalking)[3]?.match(/\((?:oooo|OOOO)\)/)?.[0]

  expect([CALM, CALM + 1].map(tick => treads([still(1)], false, tick))).toEqual(['(oooo)', '(oooo)'])
  expect([CALM, CALM + 1].map(tick => treads([still(1)], true, tick))).toEqual(['(oooo)', '(OOOO)'])
  expect([CALM, CALM + 1].map(tick => treads([still(1, 3)], false, tick))).toEqual(['(oooo)', '(OOOO)'])
  expect([CALM, CALM + 1].map(tick => treads([{ id: 1, lag: 0, leaving: true }], false, tick))).toEqual(['(oooo)', '(OOOO)'])
})

test('a friend now and then stretches its neck: eyes on row 0, neck on row 1', () => {
  const rows = roll(standing(20), [still(0)], 1)

  expect(rows[0]).toContain('(o)(o)')
  expect(rows[1]).toContain('||')
  expect(rows[2]).toContain('=[##]=')
  expect(rows[3]).toContain('(oooo)')
  expect(roll(standing(20), [still(0)], CALM)[1]).not.toContain('||')
})

test('friends blink and look around, staggered by id', () => {
  const eyesAt = (id: number, tick: number) => roll(standing(20), [still(id)], tick)[1]?.match(/\([-oO]\)\([-oO]\)/)?.[0]
  const seen = new Set(Array.from({ length: 48 }, (_, tick) => eyesAt(2, tick)))

  expect(seen).toContain('(-)(-)')
  expect(seen).toContain('(O)(o)')
  expect(eyesAt(1, 10)).toBe('(o)(o)')
  expect(Array.from({ length: 24 }, (_, tick) => eyesAt(0, tick)).join()).not.toBe(Array.from({ length: 24 }, (_, tick) => eyesAt(1, tick)).join())
})

test('a hot context makes the eyes wide, and no friend stretches', () => {
  for (let tick = 0; tick < 24; tick++) {
    const rows = roll(standing(20), [still(0)], tick, 'hot')

    expect(rows[1]).toContain('(O)(O)')
    expect(rows[0]).not.toContain('(')
  }
})

test('cheering friends hop one row up on alternate ticks', () => {
  const hop = roll(standing(20), [still(1)], 2, 'cheer')
  const flat = roll(standing(20), [still(1)], 3, 'cheer')

  expect(hop[0]).toContain('(o)(o)')
  expect(hop[1]).toContain('=[##]=')
  expect(hop[2]).toContain('(oooo)')
  expect(hop[3]).not.toContain('(')
  expect(flat[1]).toContain('(o)(o)')
  expect(flat[3]).toContain('(oooo)')
})

test('friends stand left of the robot when it walks right, and right of it when it walks left', () => {
  const friends = [still(1), still(2)]
  const right = roll(standing(20), friends, CALM, 'normal', false, 20, 1)
  expect(right[3]?.lastIndexOf(')')).toBeLessThan(right[3]?.indexOf('o   o') ?? 0)
  expect(right[3]?.match(/\(oooo\)/g)).toHaveLength(2)
  expect(right[3]).not.toContain('+')
  expect(right[3]?.indexOf('(oooo)')).toBe(20 - 4 - 6 - 7)

  const left = roll(standing(20), friends, CALM, 'normal', false, 20, -1)
  expect(left[3]?.match(/\(oooo\)/g)).toHaveLength(2)
  expect(left[3]?.indexOf('(oooo)')).toBeGreaterThan(left[3]?.lastIndexOf('o   o') ?? 99)
})

test('the label comes after the last friend, and only when more subagents run than friends are drawn', () => {
  const three = [still(1), still(2), still(3)]
  for (const dir of [1, -1] as const) {
    const row = roll(standing(30), three, CALM, 'normal', false, 30, dir, 7, 100)[3] ?? ''
    const treads = [...row.matchAll(/\(oooo\)/g)].map(match => match.index ?? 0)

    expect(treads).toHaveLength(3)
    expect(row).toContain('+4')
    if (dir === 1) expect(row.indexOf('+4')).toBeLessThan(Math.min(...treads))
    else expect(row.indexOf('+4')).toBeGreaterThan(Math.max(...treads) + 6)
    expect(roll(standing(30), three, CALM, 'normal', false, 30, dir, 3, 100)[3]).not.toContain('+')
  }
})

test('friends never move to the front: near the back edge fewer or none are drawn', () => {
  const some = roll(standing(10), [still(1), still(2), still(3)], CALM, 'normal', false, 10)[3] ?? ''
  expect(some.match(/\(oooo\)/g)).toHaveLength(1)
  expect(some.lastIndexOf('(oooo)')).toBeLessThan(10)

  expect(roll(standing(2), [still(1), still(2)], CALM, 'normal', false, 2)).toEqual(rowsOf(standing(2)))
  expect(roll(standing(46), [still(1), still(2)], CALM, 'normal', false, 46, -1, 2, 56)).toEqual(rowsOf(standing(46)))
})

test('a friend still far from its slot is not drawn, and one rolling in is drawn once it fits', () => {
  expect(roll(standing(20), [still(1, 40)], CALM)).toEqual(rowsOf(standing(20)))
  expect(roll(standing(30), [still(1, 40)], CALM, 'normal', false, 30, -1)).toEqual(rowsOf(standing(30)))
  expect(roll(standing(20), [still(1, 3)], CALM)[3]).toContain('(')
  expect(roll(standing(20), [still(1, 3)], CALM)[3]?.indexOf('(')).toBe(20 - 4 - 6 - 3)
})

test('friends stand at the back of a robot that fishes to its left, whatever dir says', () => {
  const fishing: Frame = ['  ✨   .-----.', '🐟 ~  [o   o]', '~~~~~  /|━━━|\\', '       o   o'].map(raw => [{ text: ' '.repeat(10) + raw, color: DEFAULT_COLOR }])
  for (const dir of [1, -1] as const) {
    const row = roll(fishing, [still(1), still(2)], CALM, 'normal', false, 10, dir)[3] ?? ''

    expect(row.match(/\(oooo\)/g)).toHaveLength(2)
    expect(row.indexOf('(oooo)')).toBeGreaterThan(row.lastIndexOf('o   o'))
  }
})

test('friends of a robot that fishes to its right stand on its left', () => {
  const fishing: Frame = ['  .-----.  ✨', '  [o   o] ~ 🐟', '  /|━━━|\\  ~~~~~', '   o   o'].map(raw => [{ text: ' '.repeat(30) + raw, color: DEFAULT_COLOR }])
  for (const dir of [1, -1] as const) {
    const row = roll(fishing, [still(1)], CALM, 'normal', false, 30, dir)[3] ?? ''

    expect(row.match(/\(oooo\)/g)).toHaveLength(1)
    expect(row.indexOf('(oooo)')).toBeLessThan(row.indexOf('o   o'))
  }
})

test('friends join the celebration on the side its words are not', () => {
  const frame = celebrating(20, 60, 'commit', 3)
  const row = roll(frame, [still(1)], CALM, 'cheer', false, 20)[3] ?? ''

  expect(row.indexOf('(')).toBeLessThan(20)
})

test('friends never pass the columns', () => {
  for (const [x, columns] of [[0, 60], [2, 60], [20, 60], [40, 56], [45, 56], [2, 30]] as const) {
    for (const dir of [1, -1] as const) {
      for (const lag of [0, 2, 9, 39]) {
        for (const mood of ['normal', 'hot', 'cheer'] as const) {
          const friends = [still(1, lag), still(2, lag), still(3, lag)]
          for (const row of withFriends(standing(x), x, dir, columns, friends, 12, 0, mood, true)) expect(cellsOf(textOf(row))).toBeLessThanOrEqual(columns)
        }
      }
    }
  }
})
