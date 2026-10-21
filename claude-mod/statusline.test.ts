import { expect, test } from 'claude-code/testing'

import { cellsOf } from './frames'
import type { Span } from './frames'
import { accountNameOf, coldGroupOf, compactingOf, COMPACTING_COLOR, effortColorOf, fitStatus, groupsOf, isSameName, modelColorOf, leftOf, modelNameOf, SHIMMER, statusOf, textOfStatus, wavedOf } from './statusline'
import { shadeOf } from './shimmer'

const plain = (spans: Span[]) => textOfStatus(spans)

const NOW = Date.parse('2026-10-11T12:00:00.000Z')
const LIMITS = [
  { kind: 'five_hour', percentUsed: 6, resetsAt: '2026-10-11T16:00:00.000Z' },
  { kind: 'seven_day', percentUsed: 23, resetsAt: '2026-10-13T12:00:00.000Z' },
]
const BOTH = ['seven_day', 'five_hour']

test('the line reads every part in order, the windows as meters with time left', () => {
  const line = plain(statusOf({
    account: 'TegoAI Team', model: 'Opus 5.5', effort: 'medium', project: 'robot', branch: 'feat/x',
    rateLimits: LIMITS, windows: BOTH, limitsAt: 0, costUsd: 13.344, contextPercent: 23.4, hotAt: 25, now: NOW,
  }))

  expect(line).toBe('TegoAI Team | Opus 5.5 [medium] | robot | feat/x | 7d 23% (2d) | 5h 6% (4h) | $13.34 | ctx 23%')
})

test('missing parts are left out, and a worktree named like its branch shows once, as the branch', () => {
  const line = plain(statusOf({ model: 'Opus 5.5', project: 'feat-x', branch: 'feat/x', rateLimits: [], windows: BOTH, limitsAt: 0, hotAt: 25, now: NOW }))

  expect(line).toBe('Opus 5.5 | feat/x')
})

test('a worktree folder and a branch match when one ends with the other', () => {
  expect(isSameName('feat-x', 'feat/x')).toBe(true)
  expect(isSameName('usage-needs-spinner', 'feat/usage-needs-spinner')).toBe(true)
  expect(isSameName('worktree-x', 'x')).toBe(true)
  expect(isSameName('Robot', 'robot')).toBe(true)
  expect(isSameName('robot', 'feat/usage-needs-spinner')).toBe(false)
  expect(isSameName('spinner', 'feat/usage-needs-spinner')).toBe(true)
  expect(isSameName('inner', 'feat/spinner')).toBe(false)
})

test('only the chosen windows show, and only from the threshold', () => {
  const base = { rateLimits: LIMITS, limitsAt: 0, hotAt: 25, now: NOW }

  expect(plain(statusOf({ ...base, windows: ['five_hour'] }))).toBe('5h 6% (4h)')
  expect(plain(statusOf({ ...base, windows: BOTH, limitsAt: 20 }))).toBe('7d 23% (2d)')
})

test('time left is coarse, never negative, and skipped without a reset time', () => {
  expect(leftOf('2026-10-11T12:35:00.000Z', NOW)).toBe('35m')
  expect(leftOf('2026-10-11T11:00:00.000Z', NOW)).toBe('1m')
  expect(leftOf(undefined, NOW)).toBeUndefined()
  expect(leftOf('soon', NOW)).toBeUndefined()
})

test('a model id reads as its name; other names stay as they are', () => {
  expect(modelNameOf('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelNameOf('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5')
  expect(modelNameOf('Opus 5.5')).toBe('Opus 5.5')
  expect(modelNameOf('opus')).toBe('Opus')
  expect(modelNameOf('sonnet[1m]')).toBe('Sonnet')
  expect(modelNameOf('claude-mythos-5-1')).toBe('Mythos 5.1')
  expect(modelNameOf('')).toBe('')
})

test('each part has its own colour, and a limit is coloured by how full it is', () => {
  const spans = statusOf({ project: 'robot', branch: 'main', rateLimits: [{ kind: 'seven_day', percentUsed: 85 }], windows: ['seven_day'], limitsAt: 0, contextPercent: 10, hotAt: 25, now: NOW })

  expect(spans.find(span => span.text === 'robot')?.color).toBe('planMode')
  expect(spans.find(span => span.text === 'main')?.color).toBe('ide')
  expect(spans.find(span => span.text === '7d 85%')?.color).toBe('error')
  expect(spans.find(span => span.text === 'ctx 10%')?.color).toBe('inactive')
})

test('the account reads organisation and tier, else the name, else the email', () => {
  expect(accountNameOf({ organizationName: 'TegoAI', organizationType: 'claude_team' })).toBe('TegoAI Team')
  expect(accountNameOf({ organizationName: 'TegoAI' })).toBe('TegoAI')
  expect(accountNameOf({ displayName: 'Egor' })).toBe('Egor')
  expect(accountNameOf({ emailAddress: 'egor@example.com' })).toBe('egor')
  expect(accountNameOf(undefined)).toBeUndefined()
})

test('ctx is red from the fire level, grey below it', () => {
  const ctx = (contextPercent: number) => statusOf({ rateLimits: [], windows: [], limitsAt: 0, contextPercent, hotAt: 25, now: NOW }).at(-1)?.color

  expect(ctx(33)).toBe('error')
  expect(ctx(25)).toBe('error')
  expect(ctx(24)).toBe('inactive')
  expect(ctx(10)).toBe('inactive')
})

test('cost is grey up to $100 and yellow above it', () => {
  const cost = (costUsd: number) => statusOf({ rateLimits: [], windows: [], limitsAt: 0, costUsd, hotAt: 25, now: NOW }).at(-1)?.color

  expect(cost(18.69)).toBe('inactive')
  expect(cost(100)).toBe('inactive')
  expect(cost(100.01)).toBe('warning')
})

test('a limit is grey below 50%, yellow below 80%, red from 80%', () => {
  const limit = (percentUsed: number) => statusOf({ rateLimits: [{ kind: 'five_hour', percentUsed }], windows: ['five_hour'], limitsAt: 0, now: NOW, hotAt: 25 })[0]?.color

  expect(limit(10)).toBe('inactive')
  expect(limit(49)).toBe('inactive')
  expect(limit(50)).toBe('warning')
  expect(limit(80)).toBe('error')
})

test('the model color follows its family, and the effort color its level', () => {
  expect(modelColorOf('claude-opus-5-5')).toBe('autoAccept')
  expect(modelColorOf('Sonnet 5.5')).toBe('suggestion')
  expect(modelColorOf('claude-haiku-5-5')).toBe('success')
  expect(modelColorOf('claude-fable-5-1')).toBe('planMode')
  expect(modelColorOf('gpt-x')).toBe('inactive')
  expect(effortColorOf('low')).toBe('inactive')
  expect(effortColorOf('max')).toBe('error')
  expect(effortColorOf('odd')).toBe('inactive')
})

test('on a narrow screen the least needed parts drop out first', () => {
  const parts = {
    account: 'Acme Team', model: 'Opus 5.5', effort: 'high', project: 'robot', branch: 'feat/x',
    rateLimits: [{ kind: 'seven_day', percentUsed: 25 }, { kind: 'five_hour', percentUsed: 15 }],
    windows: BOTH, limitsAt: 0, costUsd: 21.97, contextPercent: 12, hotAt: 25, now: NOW,
  }
  const full = plain(statusOf(parts))
  expect(plain(statusOf(parts, full.length))).toBe(full)
  expect(plain(statusOf(parts, full.length - 1))).not.toContain('Acme Team')
  expect(plain(statusOf(parts, 40))).toBe('Opus 5.5 [high] | 5h 15% | ctx 12%')
  for (const width of [80, 60, 40, 30, 20]) expect(plain(statusOf(parts, width)).length).toBeLessThanOrEqual(width)
  expect(plain(statusOf(parts, 12))).toBe('ctx 12%')
  expect(plain(statusOf(parts, 5))).toBe('ctx …')
})

test('the branch shimmer sweeps a bright band across the name, then starts again', () => {
  const colors = (phase: number) => [...'feat/login'].map((_, i) => shadeOf(i, phase, 10))
  expect(colors(0)).toEqual(Array(10).fill('ide'))
  expect(colors(5)).toEqual(['merged', 'bashBorder', 'claude', 'warning', 'claude', 'bashBorder', 'merged', 'ide', 'ide', 'ide'])
  expect(colors(5).indexOf('warning')).toBe(3)
  expect(colors(10).indexOf('warning')).toBe(-1)
  expect(colors(1).filter(color => color !== 'ide')).not.toHaveLength(0)
  expect(colors(12.5)).toEqual(colors(0))
})

test('only the branch waves', () => {
  const groups = groupsOf({ project: 'robot', branch: 'main', rateLimits: [], windows: [], limitsAt: 0, hotAt: 25, now: NOW })
  const waved = wavedOf(groups)
  expect(textOfStatus(fitStatus(waved, Number.POSITIVE_INFINITY))).toBe('robot | main')
  expect(waved.find(group => group.spans[0]?.text === 'robot')?.spans[0]?.color).toBe('planMode')
  expect(waved.find(group => group.spans[0]?.text === 'main')?.spans[0]?.color).toBe(SHIMMER)
})

test('compacting squeezes the ctx percent with arrows, in the command colour, at one width', () => {
  const groups = groupsOf({ project: 'robot', contextPercent: 25, rateLimits: [], windows: [], limitsAt: 0, hotAt: 25, now: NOW })
  const texts = [0, 1, 2, 3, 4].map(at => textOfStatus(fitStatus(compactingOf(groups, at), Number.POSITIVE_INFINITY)))
  expect(texts).toEqual(['robot | ctx ▸  25%  ◂', 'robot | ctx  ▸ 25% ◂ ', 'robot | ctx   ▸25%◂  ', 'robot | ctx  ▸ 25% ◂ ', 'robot | ctx ▸  25%  ◂'])
  const ctx = compactingOf(groups, 0).find(group => group.spans[0]?.text.startsWith('ctx'))
  expect(ctx?.spans).toEqual([{ text: 'ctx ▸  25%  ◂', color: COMPACTING_COLOR }])
  expect(compactingOf(groups, 0).find(group => group.spans[0]?.text === 'robot')).toEqual(groups.find(group => group.spans[0]?.text === 'robot'))
})

test('unpushed commits show after the branch in yellow, and only the name waves', () => {
  const at = (ahead?: number) => groupsOf({ project: 'robot', branch: 'main', ahead, rateLimits: [], windows: [], limitsAt: 0, hotAt: 25, now: NOW })
  expect(textOfStatus(fitStatus(at(3), Number.POSITIVE_INFINITY))).toBe('robot | main ↑3')
  expect(textOfStatus(fitStatus(at(0), Number.POSITIVE_INFINITY))).toBe('robot | main')
  expect(textOfStatus(fitStatus(at(), Number.POSITIVE_INFINITY))).toBe('robot | main')
  const branch = at(3).find(group => group.spans[0]?.text === 'main')
  expect(branch?.spans[1]).toEqual({ text: ' ↑3', color: 'warning' })
  const waved = wavedOf(at(3)).find(group => group.spans[0]?.text === 'main')
  expect(waved?.spans).toEqual([{ text: 'main', color: SHIMMER }, { text: ' ↑3', color: 'warning' }])
})

test('the cache-cold part reads ❄ cache cold with the context to re-read, in the ide colour, 19 cells', () => {
  const { spans } = coldGroupOf(117_000)

  expect(textOfStatus(spans)).toBe('❄ cache cold · 117k')
  expect(spans.map(span => span.color)).toEqual(['ide'])
  expect(cellsOf(textOfStatus(spans))).toBe(19)
})

test('on a narrow screen the cache-cold part outlives ctx, and both keep their order', () => {
  const groups = [
    ...groupsOf({
      account: 'TegoAI Team', model: 'Opus 5.5', effort: 'medium', project: 'robot', branch: 'feat/x',
      rateLimits: LIMITS, windows: BOTH, limitsAt: 0, costUsd: 13.344, contextPercent: 23.4, hotAt: 25, now: NOW,
    }),
    coldGroupOf(117_000),
  ]

  expect(plain(fitStatus(groups, 19))).toBe('❄ cache cold · 117k')
  expect(plain(fitStatus(groups, 30))).toBe('ctx 23% | ❄ cache cold · 117k')
})
