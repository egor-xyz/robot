import { expect, test } from 'claude-code/testing'

import { gitActOf } from './git'

const CASES: [string, 'commit' | 'push' | undefined][] = [
  ['git commit -m "x"', 'commit'],
  ['git push', 'push'],
  ['git push origin main', 'push'],
  ['git add . && git commit -m x', 'commit'],
  ['git commit -m x; git log', 'commit'],
  ['git status | git commit -F -', 'commit'],
  ['git -C ~/my/robot commit -m x', 'commit'],
  ['git -C "my path" push', 'push'],
  ['git -c user.name=a commit -m x', 'commit'],
  ['git --no-pager push', 'push'],
  ['rtk git push', 'push'],
  ['cd x && rtk git commit -am y', 'commit'],
  ['git commit -m x && git push', 'push'],
  ['git push && git commit -m x', 'push'],
  ['git commit-tree abc', undefined],
  ['git push-something', undefined],
  ['git log', undefined],
  ['git status', undefined],
  ['ls', undefined],
  ['', undefined],
  ['digit commit', undefined],
]

test('a shell command is read for the git act it performs', () => {
  for (const [command, act] of CASES) expect([command, gitActOf(command)]).toEqual([command, act])
})
