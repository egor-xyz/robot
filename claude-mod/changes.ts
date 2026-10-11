import type { StatusGroup } from './statusline'

/** One changed file, as `git` counts it against HEAD. */
export type FileChange = { path: string; added: number; removed: number }

const DIM = 'inactive'
/** At most this many new files are counted line by line; the rest count as one line changed. */
export const MAX_NEW_FILES = 20

// On a narrow screen the lowest rank goes first: the count stays longest.
const RANK = { removed: 1, added: 2, count: 3 }

/**
 * The files of `git diff HEAD --numstat` output: one `added<TAB>removed<TAB>path`
 * line each. A binary file (`-` counts) counts as nothing changed in lines.
 */
export function numstatOf(stdout: string): FileChange[] {
  return stdout
    .split('\n')
    .map(line => line.split('\t'))
    .filter(cells => cells.length >= 3 && cells[2])
    .map(([added = '', removed = '', ...path]) => ({ path: path.join('\t'), added: Number(added) || 0, removed: Number(removed) || 0 }))
}

/** All changes: the tracked files first, then the new ones, each path once. */
export function changesOf(tracked: readonly FileChange[], fresh: readonly FileChange[]): FileChange[] {
  const seen = new Set(tracked.map(change => change.path))
  return [...tracked, ...fresh.filter(change => !seen.has(change.path))]
}

/** `5 files changed`, `1 file changed`. */
export const countOf = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'} changed`

/** The line under the status line: `5 files changed | +120 | -30`. Nothing when nothing changed. */
export function changesGroupsOf(changes: readonly FileChange[]): StatusGroup[] {
  if (changes.length === 0) return []
  const added = changes.reduce((sum, change) => sum + change.added, 0)
  const removed = changes.reduce((sum, change) => sum + change.removed, 0)
  return [
    { rank: RANK.count, spans: [{ text: countOf(changes.length), color: DIM }] },
    ...(added > 0 ? [{ rank: RANK.added, spans: [{ text: `+${added}`, color: 'success' }] }] : []),
    ...(removed > 0 ? [{ rank: RANK.removed, spans: [{ text: `-${removed}`, color: 'error' }] }] : []),
  ]
}

/** `+12 -3` for one file, as the panel shows it; empty for a binary file. */
export function countsOf(change: FileChange): string {
  return [change.added > 0 ? `+${change.added}` : '', change.removed > 0 ? `-${change.removed}` : ''].filter(Boolean).join(' ')
}

/** The files whose path holds every word of `query`, any case; all of them for an empty query. */
export function matchesOf(changes: readonly FileChange[], query: string): FileChange[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return changes.filter(change => words.every(word => change.path.toLowerCase().includes(word)))
}

/**
 * A panel row `columns` cells wide: the path on the left, the counts on the
 * right. A path too long loses its start (`…mod/changes.ts`): the file name stays.
 */
export function rowOf(change: FileChange, columns: number): { path: string; gap: string } {
  const counts = countsOf(change).length
  const room = Math.max(1, columns - counts - (counts > 0 ? 2 : 0))
  const path = change.path.length <= room ? change.path : `…${change.path.slice(change.path.length - room + 1)}`
  return { path, gap: ' '.repeat(Math.max(counts > 0 ? 2 : 0, columns - path.length - counts)) }
}

/** A row as the panel's list draws it: the full path to pick, the fitted name, the gap and the counts. */
export function listRowOf(change: FileChange, columns: number): { path: string; name: string; gap: string; added: number; removed: number } {
  const { path: name, gap } = rowOf(change, columns)
  return { path: change.path, name, gap, added: change.added, removed: change.removed }
}
