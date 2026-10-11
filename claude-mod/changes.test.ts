import { expect, test } from 'claude-code/testing'

import { changesGroupsOf, countOf, countsOf, groupOf, listRowOf, listRowsOf, matchesOf, numstatOf, statusesOf, totalsOf, type FileChange } from './changes'
import { shadeOf, sweepOf } from './files-list'
import { fitStatus, textOfStatus } from './statusline'

const file = (path: string, added: number, removed: number, group: FileChange['group'] = 'local', status: FileChange['status'] = 'M'): FileChange => ({ path, added, removed, status, group })

test('numstat lines become files, a binary file counts as no lines', () => {
  expect(numstatOf('3\t1\tsrc/a b.ts\n-\t-\tlogo.png\n\n')).toEqual([
    { path: 'src/a b.ts', added: 3, removed: 1 },
    { path: 'logo.png', added: 0, removed: 0 },
  ])
  expect(numstatOf('')).toEqual([])
})

test('name-status lines give each file its letter', () => {
  const letters = statusesOf('M\ta.ts\nA\tb.ts\nD\tc.ts\nT\td.ts\n')
  expect([...letters.entries()]).toEqual([['a.ts', 'M'], ['b.ts', 'A'], ['c.ts', 'D'], ['d.ts', 'M']])
})

test('a group lists the tracked files with their letters, then the new ones as added, each path once', () => {
  const tracked = [{ path: 'a.ts', added: 1, removed: 0 }, { path: 'gone.ts', added: 0, removed: 9 }]
  expect(groupOf('local', tracked, new Map([['gone.ts', 'D' as const]]), [{ path: 'b.ts', added: 5 }, { path: 'a.ts', added: 9 }])).toEqual([
    file('a.ts', 1, 0),
    file('gone.ts', 0, 9, 'local', 'D'),
    file('b.ts', 5, 0, 'local', 'A'),
  ])
})

test('the line counts the files and sums the lines', () => {
  const line = (changes: FileChange[]) => textOfStatus(fitStatus(changesGroupsOf(totalsOf(changes)), Number.POSITIVE_INFINITY))
  expect(line([file('a.ts', 100, 10), file('b.ts', 20, 20)])).toBe('2 files changed | +120 | -30')
  expect(line([file('a.ts', 4, 0)])).toBe('1 file changed | +4')
  expect(changesGroupsOf(totalsOf([]))).toEqual([])
  expect(countOf(5)).toBe('5 files changed')
})

test('a file in both groups counts once', () => {
  expect(totalsOf([file('a.ts', 1, 0), file('a.ts', 2, 0, 'pr')]).files).toBe(1)
})

test('on a narrow screen the count stays', () => {
  const groups = changesGroupsOf(totalsOf([file('a.ts', 100, 10)]))
  expect(textOfStatus(fitStatus(groups, 14))).toBe('1 file changed')
})

test('one file reads its own counts', () => {
  expect(countsOf({ added: 12, removed: 3 })).toBe('+12 -3')
  expect(countsOf({ added: 0, removed: 3 })).toBe('-3')
  expect(countsOf({ added: 0, removed: 0 })).toBe('')
})

test('search keeps the files whose path holds every word, any case', () => {
  const changes = [file('claude-mod/Changes.ts', 1, 0), file('README.md', 2, 0)]
  expect(matchesOf(changes, '').map(change => change.path)).toEqual(['claude-mod/Changes.ts', 'README.md'])
  expect(matchesOf(changes, 'changes').map(change => change.path)).toEqual(['claude-mod/Changes.ts'])
  expect(matchesOf(changes, 'mod ts').map(change => change.path)).toEqual(['claude-mod/Changes.ts'])
  expect(matchesOf(changes, 'nothing')).toEqual([])
})

test('a row puts the name first and its folder after; a narrow row cuts the folder first', () => {
  const change = file('claude-mod/changes.ts', 49, 2)
  expect(listRowOf(change, 40)).toMatchObject({ name: 'changes.ts', folder: 'claude-mod', path: 'claude-mod/changes.ts' })
  expect(listRowOf(change, 26).folder).toBe('…-mod')
  expect(listRowOf(change, 20)).toMatchObject({ name: 'changes.ts', folder: '' })
  expect(listRowOf(file('README.md', 1, 0), 40).folder).toBe('')
})

test('with a PR open the rows come in two groups, not committed first', () => {
  const changes = [file('a.ts', 1, 0), file('b.ts', 2, 0, 'pr', 'A'), file('c.ts', 3, 1, 'pr')]
  const rows = listRowsOf(changes, '', true, 40)
  expect(rows.map(row => row.heading || row.name)).toEqual(['Not committed · 1', 'a.ts', 'In PR · 2', 'b.ts', 'c.ts'])
  expect(listRowsOf(changes, 'b', true, 40).map(row => row.heading || row.name)).toEqual(['In PR · 1', 'b.ts'])
  expect(listRowsOf([file('a.ts', 1, 0)], '', false, 40).map(row => row.heading || row.name)).toEqual(['a.ts'])
})

test('the picked row shimmers once across its name', () => {
  expect([...'abc'].map((_, i) => shadeOf(i, 0, 3))).toEqual(['text', 'text', 'text'])
  expect(shadeOf(2, 4.375, 3)).toBe('warning')
  expect(sweepOf(6)).toBe(10)
})
