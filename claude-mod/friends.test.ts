import { expect, test } from 'claude-code/testing'

import { FAR, MAX_FRIENDS, stepFriends } from './friends'
import type { Friend } from './friends'

const counter = () => {
  let id = 0
  return () => ++id
}

const run = (friends: Friend[], count: number, ticks: number, nextId: () => number) => {
  let now = friends
  for (let i = 0; i < ticks; i++) now = stepFriends(now, count, nextId)
  return now
}

test('no subagents, no friends', () => {
  expect(stepFriends([], 0, counter())).toEqual([])
})

test('two subagents bring two friends that roll in one cell a tick until they stand at their slot', () => {
  const nextId = counter()
  const first = stepFriends([], 2, nextId)

  expect(first).toHaveLength(2)
  expect(first.every(friend => !friend.leaving && friend.lag >= FAR - 1)).toBe(true)
  const second = stepFriends(first, 2, nextId)
  expect(second.map(friend => friend.lag)).toEqual(first.map(friend => friend.lag - 1))

  const settled = run(second, 2, FAR, nextId)
  expect(settled.map(friend => friend.lag)).toEqual([0, 0])
  expect(settled.map(friend => friend.id)).toEqual(first.map(friend => friend.id))
})

test('a subagent that ends sends its friend away: it leaves, rolls off and is removed', () => {
  const nextId = counter()
  const settled = run([], 2, FAR + 2, nextId)
  const [stays, goes] = settled

  const leaving = stepFriends(settled, 1, nextId)
  expect(leaving.map(friend => friend.leaving)).toEqual([false, true])
  expect(leaving[1]?.lag).toBe(1)
  expect(leaving[0]?.id).toBe(stays?.id)

  const later = stepFriends(leaving, 1, nextId)
  expect(later[1]?.lag).toBe(2)

  const gone = run(later, 1, FAR, nextId)
  expect(gone.map(friend => friend.id)).toEqual([stays?.id])
  expect(gone.some(friend => friend.id === goes?.id)).toBe(false)
})

test('more subagents than the most friends drawn keep exactly that many', () => {
  const friends = run([], 5, FAR + 5, counter())

  expect(friends).toHaveLength(MAX_FRIENDS)
  expect(friends.every(friend => !friend.leaving && friend.lag === 0)).toBe(true)
})

test('friends keep their order as others come and go', () => {
  const nextId = counter()
  const settled = run([], 3, FAR + 2, nextId)
  const ids = settled.map(friend => friend.id)

  const fewer = stepFriends(settled, 1, nextId)
  expect(fewer.map(friend => friend.id)).toEqual(ids)
  expect(fewer.map(friend => friend.leaving)).toEqual([false, true, true])
})
