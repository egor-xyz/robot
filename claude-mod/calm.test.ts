import { expect, test } from 'claude-code/testing'

import { CALM_STATES } from './calm'
import { STATES } from './robot'

test('every calm state is a real state', () => {
  for (const state of CALM_STATES) expect(STATES).toContain(state)
})
