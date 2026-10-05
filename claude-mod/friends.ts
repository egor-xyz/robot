/** One subagent friend: `lag` is the cells it still is away from its slot, toward the back edge of the screen. */
export type Friend = { id: number; lag: number; leaving: boolean }

/** Most friends drawn at once. */
export const MAX_FRIENDS = 3
/** Cells away from its slot where a friend starts rolling in and where a leaving one is gone. */
export const FAR = 40

/**
 * One tick of the friends: one non-leaving friend per running subagent (at most MAX_FRIENDS), each new one far away so
 * it rolls in from the edge; surplus ones turn to leaving and roll away. Order is stable, slot = index.
 */
export function stepFriends(friends: Friend[], count: number, nextId: () => number): Friend[] {
  const wanted = Math.min(Math.max(count, 0), MAX_FRIENDS)
  const next = friends.map(friend => ({ ...friend }))
  while (next.filter(friend => !friend.leaving).length < wanted) next.push({ id: nextId(), lag: FAR, leaving: false })
  while (next.filter(friend => !friend.leaving).length > wanted) {
    const last = next.findLast(friend => !friend.leaving)
    if (last) last.leaving = true
  }
  return next
    .map(friend => ({ ...friend, lag: friend.leaving ? friend.lag + 1 : Math.max(0, friend.lag - 1) }))
    .filter(friend => friend.lag < FAR)
}
