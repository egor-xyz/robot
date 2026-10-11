import { expect, test } from 'claude-code/testing'

import { changesGroupsOf, changesOf, countOf, countsOf, listRowOf, matchesOf, numstatOf, rowOf } from './changes'
import { shadeOf, sweepOf } from './files-list'
import { fitStatus, textOfStatus } from './statusline'

test('numstat lines become files, a binary file counts as no lines', () => {
  expect(numstatOf('3\t1\tsrc/a b.ts\n-\t-\tlogo.png\n\n')).toEqual([
    { path: 'src/a b.ts', added: 3, removed: 1 },
    { path: 'logo.png', added: 0, removed: 0 },
  ])
  expect(numstatOf('')).toEqual([])
})

test('new files come after the tracked ones, each path once', () => {
  const tracked = [{ path: 'a.ts', added: 1, removed: 0 }]
  expect(changesOf(tracked, [{ path: 'b.ts', added: 5, removed: 0 }, { path: 'a.ts', added: 9, removed: 0 }])).toEqual([
    { path: 'a.ts', added: 1, removed: 0 },
    { path: 'b.ts', added: 5, removed: 0 },
  ])
})

test('the line counts the files and sums the lines', () => {
  const line = (changes: Parameters<typeof changesGroupsOf>[0]) => textOfStatus(fitStatus(changesGroupsOf(changes), Number.POSITIVE_INFINITY))
  expect(line([{ path: 'a.ts', added: 100, removed: 10 }, { path: 'b.ts', added: 20, removed: 20 }])).toBe('2 files changed | +120 | -30')
  expect(line([{ path: 'a.ts', added: 4, removed: 0 }])).toBe('1 file changed | +4')
  expect(changesGroupsOf([])).toEqual([])
  expect(countOf(5)).toBe('5 files changed')
})

test('on a narrow screen the count stays', () => {
  const groups = changesGroupsOf([{ path: 'a.ts', added: 100, removed: 10 }])
  expect(textOfStatus(fitStatus(groups, 14))).toBe('1 file changed')
})

test('one file reads its own counts', () => {
  expect(countsOf({ path: 'a.ts', added: 12, removed: 3 })).toBe('+12 -3')
  expect(countsOf({ path: 'a.ts', added: 0, removed: 3 })).toBe('-3')
  expect(countsOf({ path: 'logo.png', added: 0, removed: 0 })).toBe('')
})

test('search keeps the files whose path holds every word, any case', () => {
  const changes = [{ path: 'claude-mod/Changes.ts', added: 1, removed: 0 }, { path: 'README.md', added: 2, removed: 0 }]
  expect(matchesOf(changes, '').map(change => change.path)).toEqual(['claude-mod/Changes.ts', 'README.md'])
  expect(matchesOf(changes, 'changes').map(change => change.path)).toEqual(['claude-mod/Changes.ts'])
  expect(matchesOf(changes, 'mod ts').map(change => change.path)).toEqual(['claude-mod/Changes.ts'])
  expect(matchesOf(changes, 'nothing')).toEqual([])
})

test('a panel row puts the path left and the counts right, and cuts a long path at its start', () => {
  const change = { path: 'claude-mod/changes.ts', added: 49, removed: 2 }
  const { path, gap } = rowOf(change, 30)
  expect(`${path}${gap}${countsOf(change)}`).toBe('claude-mod/changes.ts   +49 -2')
  const narrow = rowOf(change, 20)
  expect(narrow.path).toBe('…/changes.ts')
  expect(`${narrow.path}${narrow.gap}${countsOf(change)}`.length).toBe(20)
})

test('a list row keeps the full path to pick and the fitted name to draw', () => {
  const row = listRowOf({ path: 'claude-mod/changes.ts', added: 49, removed: 2 }, 20)
  expect(row.path).toBe('claude-mod/changes.ts')
  expect(row.name).toBe('…/changes.ts')
  expect(`${row.name}${row.gap}+49 -2`.length).toBe(20)
})

test('the picked row shimmers once across its name', () => {
  expect([...'abc'].map((_, i) => shadeOf(i, 0, 3))).toEqual(['text', 'text', 'text'])
  expect(shadeOf(2, 4.375, 3)).toBe('warning')
  expect(sweepOf(6)).toBe(10)
})
