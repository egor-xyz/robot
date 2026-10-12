import type { StepUsage } from './agents'

export type CacheTtl = '5m' | '1h'
export const TTL_MS: Record<CacheTtl, number> = { '5m': 300_000, '1h': 3_600_000 }
/** How far past 5 minutes a break must run before a cache read there proves the 1-hour cache. */
export const LEARN_MARGIN_MS = 30_000

/** The TTL in use: the setting when it is '5m' or '1h', else the learned one, else '5m'. */
export function ttlOf(setting: unknown, learned: unknown): CacheTtl {
  if (setting === '5m' || setting === '1h') return setting
  if (learned === '1h' || learned === '5m') return learned
  return '5m'
}

/** '1h' when a main request after a break of (5m + margin, 1h) still read at least half its prompt from the cache; else undefined. */
export function learnedTtlOf(breakMs: number, usage: StepUsage): CacheTtl | undefined {
  const read = usage.cache_read_input_tokens
  const prompt = read + usage.cache_creation_input_tokens + usage.input_tokens
  const isLong = breakMs > TTL_MS['5m'] + LEARN_MARGIN_MS && breakMs < TTL_MS['1h']
  return isLong && read > 0 && read * 2 >= prompt ? '1h' : undefined
}

/** Cold: there was a main request (lastAt > 0) and it is at least the TTL old. */
export function isColdAt(lastAt: number, now: number, ttl: CacheTtl): boolean {
  return lastAt > 0 && now - lastAt >= TTL_MS[ttl]
}
