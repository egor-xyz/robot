import { expect, test } from 'claude-code/testing'

import { cellsOf } from './frames'
import {
  attentionToastOf, failedChecksOf, hostOf, isPrActOf, NO_PR_INFO, prDelayOf, prInfoOf, prLineOf, prStatusOf, PR_ACT_MS, PR_BUSY_MS, PR_CALM_MS, PR_NONE_MS, PR_UNKNOWN_MS, unresolvedOf,
} from './pr'
import type { PrInfo } from './pr'
import { fitStatus, textOfStatus } from './statusline'

const URL = 'https://github.com/egor-xyz/robot/pull/12078'
const pr = (over: Partial<PrInfo> = {}): PrInfo => ({ ...NO_PR_INFO, number: 7, url: URL, ...over })
const line = (over: Partial<PrInfo> = {}): string => textOfStatus(prLineOf(pr(over)))

test('the PR line reads the number, then the state and what needs the person, worst first', () => {
  expect(textOfStatus(prLineOf(pr({ number: 12078, status: 'conflicts', isConflict: true, failed: ['lint', 'test'], threads: 4 })))).toBe('#12078: conflicts · failing: lint, test · 💬 4')
  expect(line({ status: 'draft', isConflict: true })).toBe('#7: draft · conflicts')
  expect(line({ status: 'ready' })).toBe('#7: ready')
  expect(line({ status: 'checks', threads: 2 })).toBe('#7: checks · 💬 2')
  expect(line({ status: 'failing', failed: ['a', 'b', 'c', 'd'] })).toBe('#7: failing: 4 checks')
  expect(line({ status: 'failing', failed: ['a', 'b', 'c'] })).toBe('#7: failing: a, b, c')
  expect(line()).toBe('#7')
})

test('the PR line colours the number as a link, and each part by how bad it is', () => {
  const spans = prLineOf(pr({ number: 12078, status: 'conflicts', isConflict: true, failed: ['lint'], threads: 4 }))
  const colorOf = (text: string) => spans.find(span => span.text === text)?.color
  expect(spans[0]).toEqual({ text: '#12078', color: 'suggestion', href: URL })
  expect(colorOf(': ')).toBe('inactive')
  expect(colorOf(' · ')).toBe('subtle')
  expect(colorOf('conflicts')).toBe('error')
  expect(colorOf('failing: lint')).toBe('error')
  expect(colorOf('💬 4')).toBe('warning')
  expect(prLineOf(pr({ status: 'draft' }))[2]?.color).toBe('inactive')
  expect(prLineOf(pr({ status: 'ready' }))[2]?.color).toBe('success')
  expect(prLineOf(pr({ status: 'review' }))[2]?.color).toBe('warning')
})

test('no PR number or no link, no PR line', () => {
  expect(prLineOf(NO_PR_INFO)).toEqual([])
  expect(prLineOf(pr({ url: '' }))).toEqual([])
  expect(prLineOf(pr({ number: 0 }))).toEqual([])
})

test('a narrow screen cuts the PR line from the right, and the number stays a link', () => {
  const big = pr({ number: 12078, status: 'conflicts', isConflict: true, failed: ['lint', 'test'], threads: 4 })
  const spans = fitStatus([{ rank: 1, spans: prLineOf(big) }], 20)
  const text = textOfStatus(spans)
  expect(cellsOf(text)).toBeLessThanOrEqual(20)
  expect(text.endsWith('…')).toBe(true)
  expect(spans[0]?.href).toBe(URL)
  // The 💬 is two cells wide.
  expect(cellsOf('💬 4')).toBe(4)
})

test('a failed check is gone when its latest run passed, and counts once', () => {
  const run = (name: string, conclusion: string, startedAt: string) => ({ name, status: 'COMPLETED', conclusion, startedAt })
  expect(failedChecksOf([run('lint', 'FAILURE', '2026-10-13T10:00:00Z'), run('lint', 'SUCCESS', '2026-10-13T11:00:00Z')])).toEqual([])
  expect(failedChecksOf([run('lint', 'SUCCESS', '2026-10-13T10:00:00Z'), run('lint', 'FAILURE', '2026-10-13T11:00:00Z')])).toEqual(['lint'])
  expect(failedChecksOf([run('lint', 'FAILURE', '2026-10-13T10:00:00Z'), run('lint', 'FAILURE', '2026-10-13T11:00:00Z')])).toEqual(['lint'])
  expect(failedChecksOf([{ context: 'ci/x', state: 'ERROR' }])).toEqual(['ci/x'])
  expect(failedChecksOf([run('a', 'SKIPPED', ''), run('b', 'NEUTRAL', ''), run('c', 'SUCCESS', '')])).toEqual([])
  expect(failedChecksOf([run('b', 'FAILURE', ''), run('a', 'TIMED_OUT', '')])).toEqual(['b', 'a'])
  expect(failedChecksOf(undefined)).toEqual([])
})

test('the PR state reads the worst first', () => {
  expect(prStatusOf({ isDraft: true, mergeable: 'CONFLICTING' })).toBe('draft')
  expect(prStatusOf({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })).toBe('conflicts')
  const failed = [{ status: 'COMPLETED', conclusion: 'FAILURE' }]
  const running = [{ status: 'IN_PROGRESS', conclusion: '' }, { state: 'SUCCESS' }]
  const passed = [{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { state: 'SUCCESS' }]
  expect(prStatusOf({ mergeable: 'MERGEABLE', mergeStateStatus: 'UNSTABLE', statusCheckRollup: failed })).toBe('failing')
  expect(prStatusOf({ mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED', statusCheckRollup: failed })).toBe('failing')
  expect(prStatusOf({ mergeStateStatus: 'BLOCKED', statusCheckRollup: [{ state: 'ERROR' }] })).toBe('failing')
  expect(prStatusOf({ mergeable: 'MERGEABLE', mergeStateStatus: 'UNSTABLE', statusCheckRollup: running })).toBe('checks')
  expect(prStatusOf({ mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED', statusCheckRollup: running })).toBe('checks')
  expect(prStatusOf({ mergeStateStatus: 'UNSTABLE', statusCheckRollup: passed })).toBe('ready')
  expect(prStatusOf({ mergeStateStatus: 'BLOCKED', reviewDecision: 'CHANGES_REQUESTED' })).toBe('changes')
  expect(prStatusOf({ mergeStateStatus: 'BEHIND' })).toBe('behind')
  expect(prStatusOf({ mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED' })).toBe('review')
  expect(prStatusOf({ mergeStateStatus: 'BLOCKED', reviewDecision: '' })).toBe('blocked')
  expect(prStatusOf({ mergeStateStatus: 'CLEAN', reviewDecision: 'APPROVED' })).toBe('ready')
  expect(prStatusOf({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' })).toBe('')
  expect(prStatusOf({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN', reviewDecision: 'REVIEW_REQUIRED' })).toBe('review')
  // A re-run: an old failure, then a newer success.
  const rerun = [
    { name: 'lint', status: 'COMPLETED', conclusion: 'FAILURE', startedAt: '2026-10-13T10:00:00Z' },
    { name: 'lint', status: 'COMPLETED', conclusion: 'SUCCESS', startedAt: '2026-10-13T11:00:00Z' },
  ]
  expect(prStatusOf({ mergeStateStatus: 'CLEAN', statusCheckRollup: rerun })).toBe('ready')
})

test('the PR info keeps the word and the parts from the same checks', () => {
  const view = {
    id: 'PR_1', number: 12078, url: URL, baseRefName: 'main', state: 'OPEN', mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY',
    statusCheckRollup: [{ name: 'lint', status: 'COMPLETED', conclusion: 'FAILURE' }, { name: 'test', status: 'IN_PROGRESS', conclusion: '' }],
  }
  expect(prInfoOf(view, 3)).toEqual({
    number: 12078, url: URL, baseRef: 'main', id: 'PR_1', status: 'conflicts', isConflict: true, failed: ['lint'], isRunning: true, isUnknown: false, threads: 3,
  })
  expect(prInfoOf({ ...view, mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' }, 0).isUnknown).toBe(true)
  expect(prInfoOf({ ...view, state: 'MERGED' }, 0)).toEqual(NO_PR_INFO)
  expect(prInfoOf({ ...view, number: 0 }, 0)).toEqual(NO_PR_INFO)
})

test('the unresolved review threads are counted from the GraphQL answer', () => {
  const nodes = [{ isResolved: false }, { isResolved: true }, { isResolved: false }]
  expect(unresolvedOf({ data: { node: { reviewThreads: { nodes } } } })).toBe(2)
  expect(unresolvedOf({ data: { node: { reviewThreads: { nodes: [] } } } })).toBe(0)
  expect(unresolvedOf({})).toBeUndefined()
  expect(unresolvedOf({ data: { node: null } })).toBeUndefined()
  expect(unresolvedOf({ errors: [{ message: 'nope' }] })).toBeUndefined()
  expect(unresolvedOf(null)).toBeUndefined()
})

test('the lookup waits by what the PR is doing', () => {
  expect(prDelayOf({ pr: NO_PR_INFO, unknownTries: 0, sinceActMs: 0 })).toBe(PR_BUSY_MS)
  expect(prDelayOf({ pr: NO_PR_INFO, unknownTries: 0, sinceActMs: PR_ACT_MS })).toBe(PR_NONE_MS)
  expect(prDelayOf({ pr: pr({ isUnknown: true }), unknownTries: 2, sinceActMs: PR_ACT_MS })).toBe(PR_UNKNOWN_MS)
  expect(prDelayOf({ pr: pr({ isUnknown: true, isRunning: true }), unknownTries: 3, sinceActMs: PR_ACT_MS })).toBe(PR_BUSY_MS)
  expect(prDelayOf({ pr: pr({ isUnknown: true }), unknownTries: 3, sinceActMs: PR_ACT_MS })).toBe(PR_CALM_MS)
  expect(prDelayOf({ pr: pr({ isRunning: true }), unknownTries: 0, sinceActMs: PR_ACT_MS })).toBe(PR_BUSY_MS)
  expect(prDelayOf({ pr: pr(), unknownTries: 0, sinceActMs: 1_000 })).toBe(PR_BUSY_MS)
  expect(prDelayOf({ pr: pr(), unknownTries: 0, sinceActMs: PR_ACT_MS })).toBe(PR_CALM_MS)
})

test('a push, a branch change, a gh pr act or a re-run is a PR act; a read is not', () => {
  const acts = ['git push', 'git -C /x push origin feat', 'cd a && git push -u origin HEAD', 'gh pr create --fill', 'gh pr merge 3', 'git checkout -b x', 'git switch main', 'gh run rerun 1', 'git log; git pull']
  const reads = ['git status', 'github push', 'gh pr view', 'gh pr checks 3', 'git pushx', '/usr/bin/git push']
  for (const command of acts) expect(isPrActOf(command)).toBe(true)
  for (const command of reads) expect(isPrActOf(command)).toBe(false)
})

test('the host comes from the PR link, github.com when there is none', () => {
  expect(hostOf('https://github.com/o/r/pull/1')).toBe('github.com')
  expect(hostOf('https://ghe.example.com/o/r/pull/1')).toBe('ghe.example.com')
  expect(hostOf('')).toBe('github.com')
})

test('the toast names what is new on the same PR', () => {
  expect(attentionToastOf(pr(), pr({ failed: ['lint'] }))).toBe('PR #7: failing: lint')
  expect(attentionToastOf(pr({ failed: ['lint'] }), pr({ failed: ['lint'] }))).toBeUndefined()
  // After a push the checks restart and fail again: that is a new failure, and it toasts again.
  expect(attentionToastOf(pr({ failed: [] }), pr({ failed: ['lint'] }))).toBe('PR #7: failing: lint')
  expect(attentionToastOf(pr({ threads: 2 }), pr({ threads: 3 }))).toBe('PR #7: 💬 3')
  expect(attentionToastOf(pr({ threads: 3 }), pr({ threads: 2 }))).toBeUndefined()
  expect(attentionToastOf(pr(), pr({ isConflict: true }))).toBe('PR #7: conflicts')
  expect(attentionToastOf(pr({ isConflict: true }), pr({ isConflict: true }))).toBeUndefined()
  expect(attentionToastOf(pr(), pr({ isConflict: true, failed: ['a', 'b', 'c', 'd'], threads: 1 }))).toBe('PR #7: conflicts · failing: 4 checks · 💬 1')
  expect(attentionToastOf(pr({ number: 6 }), pr({ failed: ['lint'] }))).toBeUndefined()
  expect(attentionToastOf(NO_PR_INFO, pr({ failed: ['lint'] }))).toBeUndefined()
  expect(attentionToastOf(pr(), NO_PR_INFO)).toBeUndefined()
})
