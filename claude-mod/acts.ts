import { ORANGE_INDEX, cellsOf, spansOf } from './frames'
import type { Frame } from './frames'
import type { ActName, RobotState } from './robot'

// Acts: short scenes the robot plays on command (/robot play, dice, coin),
// not on its random schedule. `slot` is a port of the zsh slot machine in
// functions/crazy-robot; `dice` and `coin` exist only here.

/** How many ticks each act plays. */
export const ACT_DUR = { slot: 45, dice: 32, coin: 20 } as const satisfies Record<ActName, number>
/** Cells an act needs from `pos`; slot centres itself on the track instead. */
export const ACT_WIDTH = { slot: 0, dice: 13, coin: 17 } as const satisfies Record<ActName, number>

// 🎰 stands in for the zsh 7️⃣: the keycap is three code points, and neither
// cellsOf nor the Svg layout can measure it. Index 6 is the jackpot.
export const SLOT_SYMBOLS: readonly string[] = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '🎰']
const JACKPOT = 6

export const DICE_FACES: Record<1 | 2 | 3 | 4 | 5 | 6, readonly [string, string, string]> = {
  1: ['     ', '  o  ', '_____'],
  2: ['o    ', '     ', '____o'],
  3: ['o    ', '  o  ', '____o'],
  4: ['o   o', '     ', 'o___o'],
  5: ['o   o', '  o  ', 'o___o'],
  6: ['o   o', 'o   o', 'o___o'],
}

const sp = (n: number) => ' '.repeat(Math.max(0, n))
const fg = (index: number) => `\x1b[38;5;${index}m`
const RESET = '\x1b[39m'

/** Turns raw rows into a frame: pad, orange body, `accent` inside [...]. */
function paint(rows: string[], pos: number, accent: number): Frame {
  const pad = sp(pos)
  const orange = fg(ORANGE_INDEX)
  return rows.map(row => {
    const lit = `${pad}${row}`.replace(/\[([^\]]*)\]/g, (_, inner: string) => `[${fg(accent)}${inner}${orange}]`)
    return spansOf(`${orange}${lit}${RESET}`)
  })
}

// ---- dice ----

const DICE_ACCENT = 39
const DICE_WIDTH = ACT_WIDTH.dice

const ARMS_IN = ['  .-----.', '  [o   o]', '   |━━━|', '   o   o']
const SQUASH = ['  .-----.', '  [-   -]', '  |━━━━━|', '   o   o']
const TUCK = ['  .-----.', '  [-   -]', '  |━━━━━|', "  '-----'"]
const BLANK_DIE = ['  .-----.', '  [     ]', '  [     ]', '  [_____]']
const SMILE = ['  .-----.', '  [^   ^]', '  /|━━━|\\', '   o   o']

const faceOf = (n: number): 1 | 2 | 3 | 4 | 5 | 6 => Math.min(6, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4 | 5 | 6

function dieOf(face: 1 | 2 | 3 | 4 | 5 | 6): string[] {
  const [a, b, c] = DICE_FACES[face]
  return ['  .-----.', `  [${a}]`, `  [${b}]`, `  [${c}]`]
}

function diceFrameOf(s: RobotState, track: number): Frame {
  const { t } = s
  const value = faceOf(s.value ?? 1)
  let rows: string[]
  if (t === 0 || t === 30) rows = ARMS_IN
  else if (t === 1 || t === 29) rows = SQUASH
  else if (t === 2 || t === 28) rows = TUCK
  else if (t === 3) rows = BLANK_DIE
  else if (t >= 31) rows = SMILE
  else if (t <= 15) {
    if (t <= 11 || t % 2 === 0) {
      const max = Math.max(0, track - DICE_WIDTH)
      s.pos += s.dir
      if (s.pos >= max) { s.pos = max; s.dir = -1 }
      if (s.pos <= 0) { s.pos = 0; s.dir = 1 }
    }
    rows = dieOf(faceOf(1 + ((value + 5 * t) % 6)))
  } else {
    rows = dieOf(value)
    // Sparkle on landing, after the top row.
    if (t <= 17) rows = rows.map((row, i) => (i === 0 ? `${row}  ✨` : row))
  }
  return paint(rows, s.pos, DICE_ACCENT)
}

// ---- coin ----

const COIN_CELL = 11
const COIN_ROWS = [3, 2, 1, 1, 1, 1, 2, 3]
const COIN_SPIN = ['o', '-', 'O', '|']
const COIN_FLIGHT = 214
const COIN_YES = 82
const COIN_NO = 203

function coinFrameOf(s: RobotState): Frame {
  const { t } = s
  const yes = s.value === 1
  const rows = ['  .-----.', '  [o   o]', '  /|━━━|━o', '   o   o']
  // The coin goes at a fixed cell; `row` is 1-based like R1..R4.
  const put = (row: number, glyph: string) => {
    const at = row - 1
    rows[at] = `${rows[at]}${sp(COIN_CELL - cellsOf(rows[at] ?? ''))}${glyph}`
  }
  let accent = COIN_FLIGHT
  if (t === 0) {
    put(3, '🪙')
  } else if (t <= 8) {
    put(COIN_ROWS[t - 1] ?? 3, COIN_SPIN[t % 4] ?? 'o')
  } else if (t === 9) {
    rows[1] = '  [O   O]'
    put(3, '🪙')
  } else {
    rows[1] = yes ? '  [^   ^]  [YES]' : '  [-   -]  [NO]'
    put(3, '🪙')
    accent = yes ? COIN_YES : COIN_NO
  }
  return paint(rows, s.pos, accent)
}

// ---- slot ----

const SLOT_COLOR = 226
const STOPS = [8, 13, 18]
const SLOT_ARM_UP = "  .-----.\\o\n  [o   o]\n   |━━━|\n   o   o"
const SLOT_WAIT = "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o"
const SLOT_WIN_A = "  .-----.\n  [O   O]\n  /|━━━|\\\n   ~   ~"
const SLOT_WIN_B = "  .-----.\n  [O   O]\n   |━━━|\n   '   '"
const SLOT_LOSS = "  .-----.\n  [- _ -]\n  /|━━━|\\\n   o   o"

/** The three reels' final symbols, packed in `value`. */
const finalsOf = (value: number): number[] => [Math.floor(value / 49) % 7, Math.floor(value / 7) % 7, value % 7]

function slotFrameOf(s: RobotState, track: number, random: () => number): Frame {
  const { t } = s
  if (t === 0) {
    // The same draws, in the same order, as the zsh slot.
    s.mirror = (random() % 2) as 0 | 1
    let f = [random() % 7, random() % 7, random() % 7]
    if (random() % 100 < 15) f = [JACKPOT, JACKPOT, JACKPOT]
    s.value = f[0]! * 49 + f[1]! * 7 + f[2]!
  }
  const value = s.value ?? 0
  const finals = finalsOf(value)
  const reels = STOPS.map((stop, i) => {
    if (t === 0) return '❓'
    if (t >= stop) return SLOT_SYMBOLS[finals[i]!] ?? '❓'
    const rem = stop - t
    const rate = rem > 5 ? 1 : rem > 2 ? 2 : 3
    return SLOT_SYMBOLS[(value + 5 * i + Math.floor((t - 1) / rate)) % 7] ?? '❓'
  })
  const locked = t >= STOPS[2]!
  const jackpot = locked && finals.every(f => f === JACKPOT)

  const robot = (t === 0 ? SLOT_ARM_UP : !locked ? SLOT_WAIT : jackpot ? (t % 2 === 0 ? SLOT_WIN_A : SLOT_WIN_B) : SLOT_LOSS).split('\n')

  const base = ['.--------------.', `| ${reels[0]} | ${reels[1]} | ${reels[2]} |`, '| -- | -- | -- |', "'----[o-o-o]---'"]
  const orange = fg(ORANGE_INDEX)
  const sc = fg(SLOT_COLOR)
  const mirror = s.mirror === 1

  // Every cell is counted from the design widths: the machine rows are 16
  // cells, the lever adds 2/1/4, the robot rows are 9-11 cells.
  if (mirror) {
    const off = Math.max(0, Math.floor((track - 30) / 2))
    const lever = t === 0 ? ['  o ', '   \\', '    ', '    '] : ['    ', '    ', 'o---', '    ']
    return robot.map((r, i) => {
      // The machine starts at off + 9 and overwrites what the robot has there.
      const left = r.slice(0, 9).padEnd(9)
      return spansOf(`${sp(off)}${orange}${left}${RESET}${sc}${lever[i]}${base[i]}${RESET}`)
    })
  }
  const off = Math.max(0, Math.floor((track - 32) / 2))
  const knob = t === 0 ? [' o', '/', '', ''] : ['', '', '---o', '']
  return robot.map((r, i) => {
    const machine = `${base[i]}${knob[i]}`
    const gap = 21 - cellsOf(machine)
    return spansOf(`${sp(off)}${sc}${machine}${RESET}${sp(gap)}${orange}${r}${RESET}`)
  })
}

/** One act tick; may set s.value/s.mirror at t 0 (slot). Never changes s.t. */
export function actFrameOf(s: RobotState, track: number, random: () => number): Frame {
  switch (s.state as ActName) {
    case 'dice': return diceFrameOf(s, track)
    case 'coin': return coinFrameOf(s)
    default: return slotFrameOf(s, track, random)
  }
}
