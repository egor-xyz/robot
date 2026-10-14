import { expect, test } from 'claude-code/testing'

import { ACT_DUR, ACT_WIDTH, DICE_FACES, SLOT_SYMBOLS, actFrameOf } from './acts'
import { CALM_STATES } from './calm'
import { cellsOf } from './frames'
import type { Frame } from './frames'
import { ACTS, INITIAL, STATES, actOf, isActing, step } from './robot'
import type { ActName, RobotState } from './robot'

const TRACK = 80
const textOf = (frame: Frame) => frame.map(row => row.map(span => span.text).join(''))

/** A random() that returns the given values in order, then 0. */
function scripted(...values: number[]): () => number {
  let i = 0
  return () => values[i++] ?? 0
}

/** Plays an act to its end, returning each tick's frame and the state after it. */
function play(name: ActName, value: number, random: () => number = () => 0, pos = 5) {
  let state = actOf({ ...INITIAL, pos }, name, value, TRACK)
  const ticks: { frame: Frame; state: RobotState }[] = []
  for (let i = 0; i < ACT_DUR[name]; i++) {
    const next = step(state, TRACK, random)
    ticks.push(next)
    state = next.state
  }
  return { ticks, state }
}

const faceRows = (face: 1 | 2 | 3 | 4 | 5 | 6) => ['  .-----.', ...DICE_FACES[face].map(row => `  [${row}]`)]

test('dice holds the face of value from tick 16 to 27, for every value', () => {
  for (const value of [1, 2, 3, 4, 5, 6] as const) {
    const { ticks } = play('dice', value)
    for (let t = 16; t <= 27; t++) {
      const rows = textOf(ticks[t]!.frame).map(row => row.trimStart())
      const want = faceRows(value).map(row => row.trimStart())
      // Ticks 16 and 17 add a sparkle after the top row.
      expect(rows.slice(1)).toEqual(want.slice(1))
      expect(rows[0]!.startsWith(want[0]!)).toBe(true)
    }
  }
})

test('dice rolls through changing faces', () => {
  const { ticks } = play('dice', 3)
  const faces = ticks.slice(4, 16).map(tick => textOf(tick.frame).slice(1).join('|').replace(/\s+/g, ' '))
  for (let i = 1; i < faces.length; i++) expect(faces[i]).not.toBe(faces[i - 1])
})

test('every act frame has four rows, no escapes and fits the band', () => {
  for (const name of ACTS) {
    for (const value of [0, 1, 6]) {
      for (const mirrorDraw of [0, 1]) {
        const { ticks } = play(name, value, scripted(mirrorDraw, 1, 2, 3, 50))
        for (const { frame } of ticks) {
          expect(frame.length).toBe(4)
          for (const row of textOf(frame)) {
            expect(row.includes('\x1b')).toBe(false)
            expect(cellsOf(row)).toBeLessThanOrEqual(TRACK + 21)
          }
        }
      }
    }
  }
})

test('coin shows YES for 1 and NO for 0 from tick 10 to 19', () => {
  for (const [value, word, other] of [[1, '[YES]', '[NO]'], [0, '[NO]', '[YES]']] as const) {
    const { ticks } = play('coin', value)
    for (let t = 10; t <= 19; t++) {
      const text = textOf(ticks[t]!.frame).join('\n')
      expect(text.includes(word)).toBe(true)
      expect(text.includes(other)).toBe(false)
    }
    expect(textOf(ticks[5]!.frame).join('\n').includes('[')).toBe(true)
    expect(textOf(ticks[5]!.frame).join('\n').includes(word)).toBe(false)
  }
})

test('slot reels decode from value once they lock, and a jackpot shows three 🎰', () => {
  // mirror 0, reels 1 2 3, no jackpot (50 >= 15).
  const plain = play('slot', 0, scripted(0, 1, 2, 3, 50))
  expect(plain.ticks[0]!.state.value).toBe(1 * 49 + 2 * 7 + 3)
  const row = textOf(plain.ticks[18]!.frame)[1]!
  expect(row).toContain(`| ${SLOT_SYMBOLS[1]} | ${SLOT_SYMBOLS[2]} | ${SLOT_SYMBOLS[3]} |`)

  // 10 < 15 forces the jackpot.
  const jackpot = play('slot', 0, scripted(1, 1, 2, 3, 10))
  const win = textOf(jackpot.ticks[30]!.frame)[1]!
  expect(win).toContain('| 🎰 | 🎰 | 🎰 |')
})

test('slot starts on question marks and the reels have not all stopped at tick 10', () => {
  const { ticks } = play('slot', 0, scripted(0, 1, 2, 3, 50))
  expect(textOf(ticks[0]!.frame)[1]).toContain('| ❓ | ❓ | ❓ |')
  expect(textOf(ticks[10]!.frame)[1]).not.toContain(`| ${SLOT_SYMBOLS[1]} | ${SLOT_SYMBOLS[2]} | ${SLOT_SYMBOLS[3]} |`)
})

test('an act runs for its dur and then the robot walks on', () => {
  for (const name of ACTS) {
    let state = actOf({ ...INITIAL, pos: 4 }, name, 1, TRACK)
    expect(isActing(state)).toBe(true)
    for (let i = 0; i < ACT_DUR[name]; i++) {
      expect(isActing(state)).toBe(true)
      expect(state.state).toBe(name)
      state = step(state, TRACK, () => 0).state
    }
    expect(isActing(state)).toBe(false)
    state = step(state, TRACK, () => 0).state
    expect(state.state).toBe('walk')
  }
})

test('actOf clamps pos so the act fits, and slot keeps pos', () => {
  const start: RobotState = { ...INITIAL, pos: 70 }
  expect(actOf(start, 'dice', 1, 40).pos).toBe(40 - ACT_WIDTH.dice)
  expect(actOf(start, 'coin', 1, 10).pos).toBe(0)
  expect(actOf(start, 'dice', 1, 200).pos).toBe(70)
  expect(actOf(start, 'slot', 0, 40).pos).toBe(70)
  expect(actOf(start, 'coin', 1, 80)).toMatchObject({ state: 'coin', t: 0, dur: 20, value: 1 })
})

test('the dice roll stays inside the track', () => {
  const { ticks } = play('dice', 4, () => 0, 0)
  for (const { state } of ticks) {
    expect(state.pos).toBeGreaterThanOrEqual(0)
    expect(state.pos).toBeLessThanOrEqual(TRACK - ACT_WIDTH.dice)
  }
})

test('acts are not random or calm states', () => {
  for (const name of ACTS) {
    expect(STATES.includes(name)).toBe(false)
    expect(CALM_STATES.includes(name)).toBe(false)
  }
})

test('actFrameOf never changes t', () => {
  const state = actOf(INITIAL, 'dice', 2, TRACK)
  const copy = { ...state, t: 7 }
  actFrameOf(copy, TRACK, () => 0)
  expect(copy.t).toBe(7)
})
