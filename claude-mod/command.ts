import { CALM_OFF_TEXT, CALM_ON_TEXT } from './calm'
import { STATES } from './robot'
import type { ActName } from './robot'

/** The settings `/robot` flips and saves. */
export type ToggleKey = 'robot' | 'statusLine' | 'changesLine' | 'calm'
export type RobotCommand =
  | { kind: 'toggle'; key: ToggleKey }
  | { kind: 'files' }
  | { kind: 'agents' }
  | { kind: 'act'; act: ActName }
  | { kind: 'animate'; name: string }
  | { kind: 'animations' }
  | { kind: 'help' }

export const HELP_TEXT = 'Use /robot (hide or show), /robot status, /robot changes, /robot calm, /robot files, /robot agents, /robot play, /robot dice, /robot coin or /robot animate <name>.'
export const ANIMATIONS_TEXT = `Use /robot animate <name>: ${STATES.join(', ')}.`

const WORDS: Record<string, RobotCommand> = {
  '': { kind: 'toggle', key: 'robot' },
  status: { kind: 'toggle', key: 'statusLine' },
  changes: { kind: 'toggle', key: 'changesLine' },
  calm: { kind: 'toggle', key: 'calm' },
  files: { kind: 'files' },
  agents: { kind: 'agents' },
  play: { kind: 'act', act: 'slot' },
  dice: { kind: 'act', act: 'dice' },
  coin: { kind: 'act', act: 'coin' },
}

/** What `/robot <args>` means, in any letter case; a typo or a second word gets the help. `animate` takes an animation's name. */
export function commandOf(args: string): RobotCommand {
  const [word = '', name, ...rest] = args.trim().toLowerCase().split(/\s+/)
  if (word === 'animate') return name && !rest.length && STATES.includes(name) ? { kind: 'animate', name } : { kind: 'animations' }
  return name === undefined && Object.hasOwn(WORDS, word) ? WORDS[word] : { kind: 'help' }
}

const DEFAULT_ON: Record<ToggleKey, boolean> = { robot: true, statusLine: true, changesLine: true, calm: false }
const TITLE: Record<ToggleKey, string> = { robot: 'Robot', statusLine: 'Status line', changesLine: 'PR and files line', calm: 'Calm mode' }
const TEXT: Record<ToggleKey, readonly [string, string]> = {
  robot: ['Robot hidden.', 'Robot is back.'],
  statusLine: ['Status line hidden.', 'Status line is back.'],
  changesLine: ['PR and files line hidden.', 'PR and files line is back.'],
  calm: [CALM_OFF_TEXT, CALM_ON_TEXT],
}

/** A saved value as on or off; an unset row (or anything but a boolean) is the setting's default. */
export function isOnOf(key: ToggleKey, value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_ON[key]
}

/** The reply after a flip; `isOn` is the new value. */
export function toggleTextOf(key: ToggleKey, isOn: boolean): string {
  return TEXT[key][isOn ? 1 : 0]
}

export function toggleDenyTextOf(key: ToggleKey, deny: string): string {
  return `${TITLE[key]} not changed: ${deny}`
}

/** The reply to an act while the robot is hidden; it names the value the robot would land on. */
export function actTextOf(act: ActName, value: number): string {
  if (act === 'dice') return `🎲 You rolled ${value}.`
  if (act === 'coin') return value === 1 ? '🪙 Yes.' : '🪙 No.'
  return '🎰 Pulling the lever…'
}
