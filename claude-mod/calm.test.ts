import { expect, test } from 'claude-code/testing'

import { CALM_OFF_TEXT, CALM_ON_TEXT, CALM_STATES, calmCommandOf } from './calm'
import { STATES } from './robot'

const USAGE = 'Use /robot calm to turn calm mode on or off.'

test('calmCommandOf ignores args that are not calm', () => {
  for (const args of ['', 'files', 'calmer']) expect(calmCommandOf(args, false)).toBeUndefined()
})

test('bare calm toggles', () => {
  expect(calmCommandOf('calm', false)).toEqual({ calm: true, text: CALM_ON_TEXT })
  expect(calmCommandOf('calm', true)).toEqual({ calm: false, text: CALM_OFF_TEXT })
})

test('calm parsing ignores case and spacing', () => {
  expect(calmCommandOf('  CALM  ', true)).toEqual({ calm: false, text: CALM_OFF_TEXT })
})

test('a bad calm argument gets the usage text', () => {
  for (const args of ['calm on', 'calm off', 'calm maybe']) expect(calmCommandOf(args, false)).toEqual({ text: USAGE })
})

test('every calm state is a real state', () => {
  for (const state of CALM_STATES) expect(STATES).toContain(state)
})
