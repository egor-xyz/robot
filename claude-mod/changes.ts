import type { StatusGroup } from './statusline'

/** How git changed a file: modified, added (new files too) or deleted. */
export type FileStatus = 'M' | 'A' | 'D'

/**
 * One changed file with its added and removed lines. `group`: `local` for
 * changes not committed yet (against HEAD), `pr` for what an open PR's commits
 * changed (against where its branch began). A file can be in both.
 */
export type FileChange = { path: string; added: number; removed: number; status: FileStatus; group: 'local' | 'pr' }

/** What the line under the status line counts. */
export type ChangeTotals = { files: number; added: number; removed: number }

const DIM = 'inactive'
/** At most this many new files are counted line by line; the rest count as one line changed. */
export const MAX_NEW_FILES = 20

// On a narrow screen the lowest rank goes first: the count stays longest.
const RANK = { removed: 1, added: 2, count: 3 }

/** The colour of each status letter, as editors draw them. */
export const STATUS_COLORS: Record<FileStatus, string> = { M: 'warning', A: 'success', D: 'error' }

/**
 * The files of `git diff --numstat` output: one `added<TAB>removed<TAB>path`
 * line each. A binary file (`-` counts) counts as nothing changed in lines.
 */
export function numstatOf(stdout: string): { path: string; added: number; removed: number }[] {
  return stdout
    .split('\n')
    .map(line => line.split('\t'))
    .filter(cells => cells.length >= 3 && cells[2])
    .map(([added = '', removed = '', ...path]) => ({ path: path.join('\t'), added: Number(added) || 0, removed: Number(removed) || 0 }))
}

/** Each path's letter from `git diff --name-status` output (`M\tpath`); any other letter reads as M. */
export function statusesOf(stdout: string): Map<string, FileStatus> {
  const found = new Map<string, FileStatus>()
  for (const line of stdout.split('\n')) {
    const [letter = '', ...path] = line.split('\t')
    if (!letter || path.length === 0) continue
    found.set(path.join('\t'), letter[0] === 'A' ? 'A' : letter[0] === 'D' ? 'D' : 'M')
  }
  return found
}

/** One group's files: the tracked ones with their letters, then the new ones (added, each path once). */
export function groupOf(
  group: FileChange['group'],
  tracked: readonly { path: string; added: number; removed: number }[],
  statuses: ReadonlyMap<string, FileStatus>,
  fresh: readonly { path: string; added: number }[] = [],
): FileChange[] {
  const seen = new Set(tracked.map(change => change.path))
  return [
    ...tracked.map(change => ({ ...change, status: statuses.get(change.path) ?? ('M' as const), group })),
    ...fresh.filter(change => !seen.has(change.path)).map(change => ({ path: change.path, added: change.added, removed: 0, status: 'A' as const, group })),
  ]
}

/** The files and lines of a list of changes, each path counted once. */
export function totalsOf(changes: readonly { path: string; added: number; removed: number }[]): ChangeTotals {
  return {
    files: new Set(changes.map(change => change.path)).size,
    added: changes.reduce((sum, change) => sum + change.added, 0),
    removed: changes.reduce((sum, change) => sum + change.removed, 0),
  }
}

/** `5 files changed`, `1 file changed`. */
export const countOf = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'} changed`

/** The line under the status line: `5 files changed | +120 | -30`. Nothing when nothing changed. */
export function changesGroupsOf(totals: ChangeTotals): StatusGroup[] {
  if (totals.files === 0) return []
  return [
    { rank: RANK.count, spans: [{ text: countOf(totals.files), color: DIM }] },
    ...(totals.added > 0 ? [{ rank: RANK.added, spans: [{ text: `+${totals.added}`, color: 'success' }] }] : []),
    ...(totals.removed > 0 ? [{ rank: RANK.removed, spans: [{ text: `-${totals.removed}`, color: 'error' }] }] : []),
  ]
}

/** `+12 -3` for one file, as the panel shows it; empty for a binary file. */
export function countsOf(change: { added: number; removed: number }): string {
  return [change.added > 0 ? `+${change.added}` : '', change.removed > 0 ? `-${change.removed}` : ''].filter(Boolean).join(' ')
}

/** The files whose path holds every word of `query`, any case; all of them for an empty query. */
export function matchesOf(changes: readonly FileChange[], query: string): FileChange[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return changes.filter(change => words.every(word => change.path.toLowerCase().includes(word)))
}

/**
 * One row of the panel's list: a group's heading (`heading` set, nothing to
 * pick), or a file: its name, its folder (dim), its counts and its letter.
 */
export type ListRow = {
  heading: string
  path: string
  group: FileChange['group']
  name: string
  folder: string
  added: number
  removed: number
  status: FileStatus
}

/** The cells a row keeps right of the name: the counts, a space, the letter. */
const tailOf = (change: { added: number; removed: number }): number => {
  const counts = countsOf(change).length
  return (counts > 0 ? counts + 1 : 0) + 2
}

/**
 * A file's row `columns` cells wide, as editors list changes: the name first,
 * then its folder, dim; the counts and the letter at the right edge. A folder
 * too long loses its start (`…/claude-mod`), and so does a name too long.
 */
export function listRowOf(change: FileChange, columns: number): ListRow {
  const cut = change.path.lastIndexOf('/')
  const file = cut < 0 ? change.path : change.path.slice(cut + 1)
  const dir = cut < 0 ? '' : change.path.slice(0, cut)
  const room = Math.max(1, columns - tailOf(change) - 1)
  const name = file.length <= room ? file : `…${file.slice(file.length - room + 1)}`
  const left = room - name.length - 1
  const folder = !dir || left < 4 ? '' : dir.length <= left ? dir : `…${dir.slice(dir.length - left + 1)}`
  return { heading: '', path: change.path, group: change.group, name, folder, added: change.added, removed: change.removed, status: change.status }
}

const headingOf = (heading: string): ListRow => ({ heading, path: '', group: 'local', name: '', folder: '', added: 0, removed: 0, status: 'M' })

/**
 * The panel's rows for the files that match `query`. With a PR open, two
 * groups under their headings: the changes not committed yet first (what
 * comes next), then the PR's own; with none, the files alone.
 */
export function listRowsOf(changes: readonly FileChange[], query: string, isPr: boolean, columns: number): ListRow[] {
  const shown = matchesOf(changes, query)
  if (!isPr) return shown.map(change => listRowOf(change, columns))
  const local = shown.filter(change => change.group === 'local')
  const pr = shown.filter(change => change.group === 'pr')
  return [
    ...(local.length > 0 ? [headingOf(`Not committed · ${local.length}`), ...local.map(change => listRowOf(change, columns))] : []),
    ...(pr.length > 0 ? [headingOf(`In PR · ${pr.length}`), ...pr.map(change => listRowOf(change, columns))] : []),
  ]
}
