import { expect, test } from 'claude-code/testing'

import { CALM_OFF_TEXT, CALM_ON_TEXT, CALM_STATES, calmCommandOf } from './calm'
import { STATES } from './robot'

const USAGE = 'Use /robot calm, /robot calm on or /robot calm off.'

test('calmCommandOf ignores args that are not calm', () => {
  for (const args of ['', 'files', 'calmer']) expect(calmCommandOf(args, false)).toBeUndefined()
})

test('bare calm toggles', () => {
  expect(calmCommandOf('calm', false)).toEqual({ calm: true, text: CALM_ON_TEXT })
  expect(calmCommandOf('calm', true)).toEqual({ calm: false, text: CALM_OFF_TEXT })
})

test('calm on and off write only when the value changes', () => {
  expect(calmCommandOf('calm on', false)).toEqual({ calm: true, text: CALM_ON_TEXT })
  expect(calmCommandOf('calm off', true)).toEqual({ calm: false, text: CALM_OFF_TEXT })
  expect(calmCommandOf('calm on', true)).toEqual({ text: 'Calm mode is already on.' })
  expect(calmCommandOf('calm off', false)).toEqual({ text: 'Calm mode is already off.' })
})

test('calm parsing ignores case and spacing', () => {
  expect(calmCommandOf('  CALM   Off ', true)).toEqual({ calm: false, text: CALM_OFF_TEXT })
})

test('a bad calm argument gets the usage text', () => {
  expect(calmCommandOf('calm maybe', false)).toEqual({ text: USAGE })
  expect(calmCommandOf('calm on now', false)).toEqual({ text: USAGE })
})

test('every calm state is a real state', () => {
  for (const state of CALM_STATES) expect(STATES).toContain(state)
})
