import { expect, test } from 'claude-code/testing'

import { agentDefOf, agentGroupsOf, agentPaneLinesOf, elapsedOf, moreOf, stepTokensOf, tokensOf, topRowsOf, viewedRowGroupsOf, viewedStatusOf } from './agents'
import { fitStatus, groupsOf, textOfStatus } from './statusline'

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

const MAIN = groupsOf({ account: 'Tego', model: 'claude-opus-5-5', effort: 'xhigh', project: 'robot', branch: 'main', rateLimits: [], windows: [], limitsAt: 0, costUsd: 1.5, contextPercent: 40, hotAt: 80, now: 0 })
const textOf = (groups: Parameters<typeof fitStatus>[0]): string => textOfStatus(fitStatus(groups, Number.POSITIVE_INFINITY))

test('with an agent in view, line 1 shows its model, tokens and time instead of the main model, cost and ctx', () => {
  expect(textOf(MAIN)).toBe('Tego | Opus 5.5 [xhigh] | robot | main | $1.50 | ctx 40%')
  expect(textOf(viewedStatusOf(MAIN, ROW, 6_000))).toBe('Tego | Haiku 5.5 [low] | robot | main | 16k tok | 0:06')
  expect(textOf(MAIN)).toBe('Tego | Opus 5.5 [xhigh] | robot | main | $1.50 | ctx 40%')
})

test('an agent in view with no model does not leave the main model on line 1', () => {
  expect(textOf(viewedStatusOf(MAIN, { ...ROW, model: '', effort: undefined }, 6_000))).not.toContain('Opus')
})

test('the agent row under line 1 has only the task and the type', () => {
  expect(textOf(viewedRowGroupsOf(ROW))).toBe('List mod settings | egor-xyz-scout')
})

test('an agent definition gives its model and effort from the frontmatter', () => {
  const head = '---\nname: egor-xyz-security-advisor\ndescription: >-\n  Reviews a diff.\n  model: not-this\nmodel: claude-mythos-5-1\neffort: high\n---\n\nmodel: nope\n'
  expect(agentDefOf(head)).toEqual({ model: 'claude-mythos-5-1', effort: 'high' })
  expect(agentDefOf('---\nmodel: "haiku"\neffort: \'low\'\n---\n')).toEqual({ model: 'haiku', effort: 'low' })
  expect(agentDefOf('# no frontmatter\nmodel: haiku\n')).toEqual({})
  expect(agentDefOf('---\nname: x\n---\nmodel: haiku\n')).toEqual({})
  expect(agentDefOf('---\n  model: x\n---\n')).toEqual({})
  expect(agentDefOf('---\nmodel: haiku\n')).toEqual({})
})

test('with no model on the main line, the agent model goes after the account', () => {
  const bare = groupsOf({ account: 'Tego', project: 'robot', branch: 'main', rateLimits: [], windows: [], limitsAt: 0, hotAt: 80, now: 0 })
  expect(textOf(viewedStatusOf(bare, ROW, 6_000))).toBe('Tego | Haiku 5.5 [low] | robot | main | 16k tok | 0:06')
})

test('agents spawned by agents count on the line of the agent the main loop spawned', () => {
  const plan = { ...ROW, id: 'p', type: 'egor-xyz-architect' }
  const scoutA = { ...ROW, id: 's1', parentId: 'p' }
  const scoutB = { ...ROW, id: 's2', parentId: 'p' }
  const deep = { ...ROW, id: 's3', parentId: 's1' }
  const build = { ...ROW, id: 'b', type: 'egor-xyz-senior-developer' }
  const orphan = { ...ROW, id: 'o', parentId: 'gone' }
  const tops = topRowsOf([plan, scoutA, scoutB, deep, build, orphan])
  expect(tops.map(top => [top.row.id, top.nested])).toEqual([['p', 3], ['b', 0], ['o', 0]])
  expect(textOfStatus(fitStatus(agentGroupsOf(plan, 6_000, 3), Number.POSITIVE_INFINITY))).toContain('egor-xyz-architect (+3)')
})
