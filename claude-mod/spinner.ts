export const ROBOT_WORDS: readonly string[] = [
  'Beep-booping',
  'Whirring',
  'Bleep-blooping',
  'Computing',
  'Calibrating',
  'Soldering',
  'Recharging',
  'Oiling gears',
  'Tightening bolts',
  'Rebooting',
  'Overclocking',
  'Defragging',
  'Crunching bits',
  'Polishing circuits',
  'Charging capacitors',
  'Spinning servos',
  'Clanking',
  'Buffering',
  'Beaming',
  'Booting up',
  'Greasing cogs',
  'Flipping bits',
  'Warming up tubes',
  'Tuning antennas',
]

// Same seed, same word: stable across re-renders within a turn.
export function robotWord(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return ROBOT_WORDS[h % ROBOT_WORDS.length] ?? 'Beep-booping'
}
