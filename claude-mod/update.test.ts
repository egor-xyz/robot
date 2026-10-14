import { expect, test } from 'claude-code/testing'

import { UPDATE_CHECK_MS, isCheckDueOf, isNewerOf, storedUpdateOf, updateToastOf, versionOf } from './update'

test('the version is a plain x.y.z in the plugin.json text, else nothing', () => {
  expect(versionOf('{"version":"0.11.0"}')).toBe('0.11.0')
  expect(versionOf('not json')).toBeUndefined()
  expect(versionOf('{"name":"robot"}')).toBeUndefined()
  expect(versionOf('{"version":"1.2"}')).toBeUndefined()
  expect(versionOf('{"version":"v1.2.3"}')).toBeUndefined()
  expect(versionOf('{"version":"1.2.3-beta"}')).toBeUndefined()
  expect(versionOf('{"version":1}')).toBeUndefined()
  expect(versionOf('<html><body>404: Not Found</body></html>')).toBeUndefined()
})

test('newer compares number by number, never as text', () => {
  expect(isNewerOf('0.11.0', '0.10.4')).toBe(true)
  expect(isNewerOf('0.10.10', '0.10.9')).toBe(true)
  expect(isNewerOf('0.10.10', '0.9.0')).toBe(true)
  expect(isNewerOf('1.0.0', '0.99.99')).toBe(true)
  expect(isNewerOf('0.10.4', '0.10.4')).toBe(false)
  expect(isNewerOf('0.10.3', '0.10.4')).toBe(false)
  expect(isNewerOf('junk', '0.10.4')).toBe(false)
  expect(isNewerOf('0.11.0', 'junk')).toBe(false)
})

test('the stored memo falls back to fresh for junk and drops wrong-typed fields', () => {
  for (const junk of [undefined, null, 'x', [], 3]) expect(storedUpdateOf(junk)).toEqual({ checkedAt: 0 })
  expect(storedUpdateOf({ checkedAt: 'x', latest: 3 })).toEqual({ checkedAt: 0 })
  const memo = { checkedAt: 5, latest: '0.11.0', told: '0.11.0' }
  expect(storedUpdateOf(memo)).toEqual(memo)
})

test('a check is due after the full interval, at once when never done, and when the clock moved back', () => {
  const now = 10 * UPDATE_CHECK_MS
  expect(isCheckDueOf(0, now)).toBe(true)
  expect(isCheckDueOf(now - UPDATE_CHECK_MS + 1, now)).toBe(false)
  expect(isCheckDueOf(now - UPDATE_CHECK_MS, now)).toBe(true)
  expect(isCheckDueOf(now + 1, now)).toBe(true)
})

test('the toast shows only for a strictly newer version nobody was told about', () => {
  const text = 'robot 0.11.0 is out (you have 0.10.4). Update: /plugin marketplace update robot'
  expect(updateToastOf('0.10.4', '0.11.0', undefined)).toBe(text)
  expect(updateToastOf('0.10.4', '0.11.0', '0.10.9')).toBe(text)
  expect(updateToastOf('0.10.4', '0.11.0', '0.11.0')).toBeUndefined()
  expect(updateToastOf('0.10.4', '0.11.0', '0.12.0')).toBeUndefined()
  expect(updateToastOf('0.10.4', undefined, undefined)).toBeUndefined()
  expect(updateToastOf('0.10.4', '0.10.4', undefined)).toBeUndefined()
  expect(updateToastOf('0.11.0', '0.10.4', undefined)).toBeUndefined()
})
