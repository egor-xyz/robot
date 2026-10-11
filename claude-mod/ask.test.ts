import { expect, test } from 'claude-code/testing'

import { isQuestion } from './ask'

test('an answer whose last line ends with a question mark asks the person', () => {
  expect(isQuestion('Done.\n\nShould I commit it?')).toBe(true)
  expect(isQuestion('Pick one: **A or B?**\n')).toBe(true)
  expect(isQuestion('Want the `--force` flag`?`')).toBe(true)
})

test('an answer that ends on a statement, or asks only earlier, does not', () => {
  expect(isQuestion('Is it fixed? Yes.\n\nAll tests pass.')).toBe(false)
  expect(isQuestion('Run `ls ?`. Then tell me.')).toBe(false)
  expect(isQuestion('')).toBe(false)
  expect(isQuestion('   \n\n')).toBe(false)
})
