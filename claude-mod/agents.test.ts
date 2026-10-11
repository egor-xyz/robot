import { expect, test } from 'claude-code/testing'

import { agentGroupsOf, elapsedOf, moreOf, stepTokensOf, tokensOf } from './agents'
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

test('on a narrow screen the type goes first and the task stays', () => {
  expect(textOfStatus(fitStatus(agentGroupsOf(ROW, 6_000), 55))).toBe('List mod settings | Haiku 5.5 [low] | 16k tok | 0:06')
  expect(textOfStatus(fitStatus(agentGroupsOf(ROW, 6_000), 20))).toBe('List mod settings')
})

test('more than 3 agents add a count line', () => {
  expect(moreOf(3)).toEqual([])
  expect(textOfStatus(moreOf(5))).toBe('+2 more')
})
