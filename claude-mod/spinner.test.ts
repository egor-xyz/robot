import { expect, test } from 'claude-code/testing'

import { ROBOT_WORDS, isCompactingMessage, robotWord } from './spinner'

test('24 unique robot words, none ending in an ellipsis', () => {
  expect(ROBOT_WORDS).toHaveLength(24)
  expect(new Set(ROBOT_WORDS).size).toBe(24)
  expect(ROBOT_WORDS.every(word => !word.endsWith('…') && !word.endsWith('...'))).toBe(true)
})

test('the same engine word always gives the same robot word', () => {
  expect(robotWord('Sauteing')).toBe(robotWord('Sauteing'))
})

test('the result is always one of the robot words, even for an empty seed', () => {
  for (const seed of ['', 'Sauteing', '🍳', 'x'.repeat(500)]) expect(ROBOT_WORDS).toContain(robotWord(seed))
})

test('different seeds spread over several words', () => {
  const seeds = ['Sauteing', 'Baking', 'Brewing', 'Cooking', 'Thinking', 'Pondering', 'Churning', 'Noodling', 'Simmering', 'Marinating', 'Whisking', 'Kneading', 'Roasting', 'Grilling', 'Frying', 'Boiling', 'Steaming', 'Toasting', 'Spinning', 'Musing', 'Cogitating', 'Ruminating', 'Percolating', 'Fermenting', 'Stewing', 'Zesting', 'Julienning', 'Flambeing', 'Braising', 'Poaching']
  expect(new Set(seeds.map(robotWord)).size).toBeGreaterThanOrEqual(6)
})

test('only the compacting spinner text counts as compacting', () => {
  expect(isCompactingMessage('Compacting conversation')).toBe(true)
  expect(isCompactingMessage('Running SessionStart hooks…')).toBe(false)
  expect(isCompactingMessage(null)).toBe(false)
})
