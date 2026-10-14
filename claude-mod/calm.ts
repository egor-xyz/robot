/** The tick period in calm mode: half the normal speed. */
export const CALM_TICK_MS = 500

/** The quiet random states calm mode picks from; all are in STATES. */
export const CALM_STATES: readonly string[] = ['static', 'blink', 'wave', 'sleep', 'smile', 'coffee', 'fishing', 'garden']

export const CALM_ON_TEXT = 'Calm mode on: the robot moves slower, plays only its quiet acts, and skips the cheer, the factory line and the branch wave.'
export const CALM_OFF_TEXT = 'Calm mode off.'
const CALM_USAGE_TEXT = 'Use /robot calm, /robot calm on or /robot calm off.'

/** What `/robot <args>` means for calm: undefined when args is not a calm command; `calm` set only when the setting must be written. */
export type CalmCommand = { calm?: boolean; text: string }

export function calmCommandOf(args: string, isCalm: boolean): CalmCommand | undefined {
  const words = args.trim().toLowerCase().split(/\s+/)
  if (words[0] !== 'calm') return undefined
  let target: boolean
  if (words.length === 1) target = !isCalm
  else if (words.length === 2 && (words[1] === 'on' || words[1] === 'off')) target = words[1] === 'on'
  else return { text: CALM_USAGE_TEXT }
  if (target === isCalm) return { text: `Calm mode is already ${target ? 'on' : 'off'}.` }
  return { calm: target, text: target ? CALM_ON_TEXT : CALM_OFF_TEXT }
}
