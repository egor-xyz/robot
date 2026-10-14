/** The tick period in calm mode: half the normal speed. */
export const CALM_TICK_MS = 500

/** The quiet random states calm mode picks from; all are in STATES. */
export const CALM_STATES: readonly string[] = ['static', 'blink', 'wave', 'sleep', 'smile', 'coffee', 'fishing', 'garden']

export const CALM_ON_TEXT = 'Calm mode on: the robot moves slower, plays only its quiet acts, and skips the cheer, the factory line and the branch wave.'
export const CALM_OFF_TEXT = 'Calm mode off.'
