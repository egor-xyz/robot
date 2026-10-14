/** Where the marketplace reads the newest plugin.json: the default branch. */
export const LATEST_URL = 'https://raw.githubusercontent.com/egor-xyz/robot/main/.claude-plugin/plugin.json'
/** How often the newest version is fetched, across all sessions: 6 hours. */
export const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000
/** How long the update toast stays. */
export const UPDATE_TOAST_MS = 15_000

/** What $.store keeps under 'updateCheck'. */
export type UpdateMemo = { checkedAt: number; latest?: string; told?: string }

const PLAIN_VERSION = /^\d+\.\d+\.\d+$/

/** The `version` of a plugin.json text, when it is a plain x.y.z; undefined for junk or bad JSON. */
export function versionOf(json: string): string | undefined {
  try {
    const version: unknown = (JSON.parse(json) as { version?: unknown } | null)?.version
    return typeof version === 'string' && PLAIN_VERSION.test(version) ? version : undefined
  } catch {
    return undefined
  }
}

/** True when `latest` is a strictly higher x.y.z than `installed` (numeric per part); false for any non-x.y.z input. */
export function isNewerOf(latest: string, installed: string): boolean {
  if (!PLAIN_VERSION.test(latest) || !PLAIN_VERSION.test(installed)) return false
  const a = latest.split('.').map(Number)
  const b = installed.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

/** The stored memo, or a fresh one ({ checkedAt: 0 }) for undefined or junk; drops fields of the wrong type. */
export function storedUpdateOf(value: unknown): UpdateMemo {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { checkedAt: 0 }
  const { checkedAt, latest, told } = value as Record<string, unknown>
  const memo: UpdateMemo = { checkedAt: typeof checkedAt === 'number' && Number.isFinite(checkedAt) ? checkedAt : 0 }
  if (typeof latest === 'string') memo.latest = latest
  if (typeof told === 'string') memo.told = told
  return memo
}

/** True when the last fetch is UPDATE_CHECK_MS old or more (checkedAt 0 is always due). */
export function isCheckDueOf(checkedAt: number, now: number): boolean {
  return checkedAt <= 0 || now < checkedAt || now - checkedAt >= UPDATE_CHECK_MS
}

/** The toast text when `latest` beats `installed` and nobody was told about `latest` (or newer) yet; else undefined. */
export function updateToastOf(installed: string, latest: string | undefined, told: string | undefined): string | undefined {
  if (!latest || !isNewerOf(latest, installed)) return undefined
  if (told && !isNewerOf(latest, told)) return undefined
  return `robot ${latest} is out (you have ${installed}). Update: /plugin marketplace update robot, then /reload-plugins`
}
