import { expect, test } from 'claude-code/testing'

import { CALM_OFF_TEXT, CALM_ON_TEXT } from './calm'
import { ANIMATIONS_TEXT, HELP_TEXT, actTextOf, commandOf, isOnOf, toggleDenyTextOf, toggleTextOf } from './command'
import type { RobotCommand } from './command'
import { STATES } from './robot'

const CASES: [string, RobotCommand][] = [
  ['', { kind: 'toggle', key: 'robot' }],
  ['status', { kind: 'toggle', key: 'statusLine' }],
  ['changes', { kind: 'toggle', key: 'changesLine' }],
  ['calm', { kind: 'toggle', key: 'calm' }],
  ['files', { kind: 'files' }],
  ['agents', { kind: 'agents' }],
  ['play', { kind: 'act', act: 'slot' }],
  ['dice', { kind: 'act', act: 'dice' }],
  ['coin', { kind: 'act', act: 'coin' }],
]

test('each word maps to its command, in any case and spacing', () => {
  for (const [word, command] of CASES) {
    expect(commandOf(word)).toEqual(command)
    expect(commandOf(`  ${word.toUpperCase()} `)).toEqual(command)
  }
})

test('a typo, an extra word or a prototype name gets the help', () => {
  for (const args of ['calm on', 'xyz', 'files x', 'options', 'constructor', 'toString']) expect(commandOf(args)).toEqual({ kind: 'help' })
})

test('animate takes any animation by name, in any case and spacing', () => {
  for (const name of STATES) {
    expect(commandOf(`animate ${name}`)).toEqual({ kind: 'animate', name })
    expect(commandOf(`  ANIMATE   ${name.toUpperCase()} `)).toEqual({ kind: 'animate', name })
  }
})

test('animate with no name, an unknown name or an extra word lists the animations', () => {
  for (const args of ['animate', 'animate xyz', 'animate walk', 'animate slot', 'animate ufo now', 'animate constructor']) expect(commandOf(args)).toEqual({ kind: 'animations' })
  for (const name of STATES) expect(ANIMATIONS_TEXT).toContain(name)
})

test('the help names every command word', () => {
  for (const word of ['status', 'changes', 'calm', 'files', 'agents', 'play', 'dice', 'coin', 'animate']) expect(HELP_TEXT).toContain(`/robot ${word}`)
})

test('isOnOf: a boolean wins, anything else is the default', () => {
  expect(isOnOf('calm', undefined)).toBe(false)
  expect(isOnOf('calm', 'x')).toBe(false)
  expect(isOnOf('calm', true)).toBe(true)
  for (const key of ['robot', 'statusLine', 'changesLine'] as const) {
    expect(isOnOf(key, undefined)).toBe(true)
    expect(isOnOf(key, 'x')).toBe(true)
    expect(isOnOf(key, false)).toBe(false)
  }
})

test('toggle texts follow the new value', () => {
  expect(toggleTextOf('robot', false)).toBe('Robot hidden.')
  expect(toggleTextOf('robot', true)).toBe('Robot is back.')
  expect(toggleTextOf('statusLine', false)).toBe('Status line hidden.')
  expect(toggleTextOf('changesLine', true)).toBe('PR and files line is back.')
  expect(toggleTextOf('calm', true)).toBe(CALM_ON_TEXT)
  expect(toggleTextOf('calm', false)).toBe(CALM_OFF_TEXT)
})

test('a denied write names the setting', () => {
  expect(toggleDenyTextOf('calm', 'locked')).toBe('Calm mode not changed: locked')
  expect(toggleDenyTextOf('changesLine', 'no')).toBe('PR and files line not changed: no')
})

test('act replies carry the value the robot lands on', () => {
  expect(actTextOf('coin', 1)).toBe('🪙 Yes.')
  expect(actTextOf('coin', 0)).toBe('🪙 No.')
  expect(actTextOf('dice', 4)).toBe('🎲 You rolled 4.')
  expect(actTextOf('slot', 0)).toBe('🎰 Pulling the lever…')
})
