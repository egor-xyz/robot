import { expect, test } from 'claude-code/testing'

import { cellsOf, framesOf } from './frames'
import type { Frame } from './frames'
import { CASES, POS, TRACK } from './parity.fixture'
import { INITIAL, STATES, filmOf, step } from './robot'
import type { RobotState } from './robot'

/** A small seeded generator giving ints like zsh $RANDOM (0..32767). */
function seeded(seed: number): () => number {
  let x = seed
  return () => {
    x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff
    return (x >>> 8) % 32768
  }
}

const textOf = (frame: Frame) => frame.map(row => row.map(span => span.text).join(''))

test('a long film has 1200 four-row frames that fit the band', () => {
  const frames = filmOf(80, 1200, seeded(1))

  expect(frames.length).toBe(1200)
  for (const frame of frames) {
    expect(frame.length).toBe(4)
    for (const row of textOf(frame)) {
      expect(cellsOf(row)).toBeLessThanOrEqual(80 + 21)
      expect(row.includes('\x1b')).toBe(false)
    }
  }
})

test('every random state shows up in a long film', () => {
  const random = seeded(7)
  const seen = new Set<string>()
  let state: RobotState = INITIAL
  for (let i = 0; i < 20000; i++) {
    const next = step(state, 80, random)
    seen.add(next.state.state)
    state = next.state
  }

  for (const name of STATES) expect(seen.has(name)).toBe(true)
  expect(seen.has('slot')).toBe(false)
})

// The cases are what the real zsh printed (scripts/gen-parity-fixture.mjs): the
// test sandbox has no process to run zsh in. Regenerate after changing crazy-robot.
test('every state draws what the real zsh draws', () => {
  expect(CASES.length).toBe(STATES.length * 24 * 2)

  for (const { state, t, mirror, first, out } of CASES) {
    const from: RobotState = { state, t, dur: 99999, pos: POS, dir: 1, mirror }
    const { frame } = step(from, TRACK, () => first)

    expect({ state, t, mirror, frame }).toEqual({ state, t, mirror, frame: framesOf(`${out}\x1e`)[0] })
  }
})
