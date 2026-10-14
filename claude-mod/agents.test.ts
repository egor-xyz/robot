import { expect, test } from 'claude-code/testing'

import { agentGroupsOf, agentPaneLinesOf, elapsedOf, moreOf, stepTokensOf, tokensOf } from './agents'
import { fitStatus, textOfStatus } from './statusline'

const ROW = { id: 'a1', type: 'egor-xyz-scout', description: 'List mod settings', model: 'claude-haiku-5-5', effort: 'low', startedAt: 0, tokens: 16_400 }

test('tokens read short', () => {
  expect(tokensOf(850)).toBe('850')
  expect(tokensOf(16_400)).toBe('16k')
  expect(tokensOf(1_240_000)).toBe('1.2M')
})

test('time reads minutes and seconds', () => {
  expect(elapsedOf(0, 6_000)).toBe('0:06')
  expect(elapsedOf(0, 760_000)).toBe('12:40')
  expect(elapsedOf(5_000, 0)).toBe('0:00')
})

test('a step counts every kind of token', () => {
  expect(stepTokensOf({ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 })).toBe(10)
})

test('an agent line shows task, type, model, effort, tokens and time', () => {
  const spans = fitStatus(agentGroupsOf(ROW, 6_000), Number.POSITIVE_INFINITY)
  expect(textOfStatus(spans)).toBe('List mod settings | egor-xyz-scout | Haiku 5.5 [low] | 16k tok | 0:06')
  expect(spans.find(span => span.text === 'Haiku 5.5')?.color).toBe('success')
})

test('an agent found after a reload, with no model yet, has no empty part', () => {
  const found = { ...ROW, model: '', effort: undefined, tokens: 0, startedAt: 6_000 }
  expect(textOfStatus(fitStatus(agentGroupsOf(found, 6_000), Number.POSITIVE_INFINITY))).toBe('List mod settings | egor-xyz-scout | 0 tok | 0:00')
})

test('on a narrow screen the type goes first and the task stays', () => {
  expect(textOfStatus(fitStatus(agentGroupsOf(ROW, 6_000), 55))).toBe('List mod settings | Haiku 5.5 [low] | 16k tok | 0:06')
  expect(textOfStatus(fitStatus(agentGroupsOf(ROW, 6_000), 20))).toBe('List mod settings')
})

test('more than 3 agents add a count line', () => {
  expect(moreOf(3)).toEqual([])
  expect(textOfStatus(moreOf(5))).toBe('+2 more')
})


test('the panel lists every agent, one line each, and says so when none run', () => {
  const mark = { text: '↳ ', color: 'inactive' }
  const rows = [ROW, { ...ROW, id: 'a2', description: 'Second' }, { ...ROW, id: 'a3' }, { ...ROW, id: 'a4' }, { ...ROW, id: 'a5' }]
  const lines = agentPaneLinesOf(rows, 6_000, Number.POSITIVE_INFINITY, mark)
  expect(lines.length).toBe(5)
  expect(textOfStatus(lines[1].slice(1))).toBe('Second | egor-xyz-scout | Haiku 5.5 [low] | 16k tok | 0:06')
  expect(lines[0][0]).toBe(mark)
  expect(agentPaneLinesOf([], 0, 40, mark)).toEqual([[{ text: 'No subagents running.', color: 'inactive' }]])
})
