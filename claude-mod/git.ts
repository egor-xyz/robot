// `git` (not part of a longer word or path), then any options before the subcommand, then commit or push.
const GIT_ACT = /(?<![\w./-])git((?:\s+(?:-[cC]\s+(?:"[^"]*"|'[^']*'|\S+)|--[\w-]+(?:=\S+)?|-[pP]))*)\s+(commit|push)(?=[\s;&|)]|$)/g

/** The git act a shell command performs, if any; a push wins over a commit when it does both. */
export function gitActOf(command: string): 'commit' | 'push' | undefined {
  const acts = [...command.matchAll(GIT_ACT)].map(match => match[2])
  if (acts.includes('push')) return 'push'
  if (acts.includes('commit')) return 'commit'
  return undefined
}
