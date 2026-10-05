import { ORANGE_INDEX, spansOf } from './frames'
import type { Frame } from './frames'

// A TypeScript twin of functions/crazy-robot: the same states, timings,
// frames and colours, drawn without zsh. Keep the two in step; robot.test.ts
// runs the real zsh and compares every frame.

/** Where the robot is in its show: which state, how far in, where it stands. */
export type RobotState = { state: string; t: number; dur: number; pos: number; dir: 1 | -1; mirror: 0 | 1 }

export const INITIAL: RobotState = { state: 'walk', t: 0, dur: 6, pos: 0, dir: 1, mirror: 0 }

// Body uses U+2501 (━) instead of `===` to dodge FiraCode-style ligatures.
const WALK_FRAMES = [
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   O   O",
]

const IDLE_FRAMES = [
  "  .-----.\n  [- - -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
  "  .-----.\\o\n  [o   o]\n   |━━━|\n   o   o",
  "  .-----.\n  [^   ^]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o]\n  /|━u━|\\\n   o   o",
  " \\.-----./\n  [O   O]\n   |━━━|\n   o   o",
  "  .-----.\n  [- _ -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [O   O]\n  /|━O━|\\\n   o   o",
  "  .-----.\n  [O   O]\n  /|━━━|\\\n   ~   ~",
  "  .-----.\n  [O   O]\n   |━━━|\n   '   '",
  "  .-----.         🌙\n  [- - O]    ==o\n  /|━━━|\\    |\n   o   o    / \\",
  "  .-----.   ·     🌙\n  [- - -]    ==o\n  /|━━━|\\    |\n   o   o    / \\",
  "\n\n\n",
  "  /\\   /\\\n  .-----.\n  [o   o]\n",
  "  /\\   /\\\n  .-----.\n  [- - -]\n",
  "  .-----.\n  [⌐   ⌐]🏀  --|_|\n  /|━━━|━       |\n   o   o        |",
  "  .-----.  🏀\n  [⌐   ⌐]    --|_|\n  /|━━━|━       |\n   o   o        |",
  "  .-----.    🏀\n  [⌐   ⌐]    --|_|\n  /|━━━|\\       |\n   o   o        |",
  "  .-----.\n  [⌐   ⌐]    🏀|_|\n  /|━━━|\\       |\n   o   o        |",
  "  .-----.\n  [^   ^]    --|_|\n  /|━━━|\\     🏀|\n   o   o        |",
  "  .-----.\n  [^   ^]✨  --|_|\n  /|━━━|\\       |\n   o   o      🏀|",
  "  .-----.\n  [o   o]\n  /|━━━|━━o\n   o   o  🔥",
  "  .-----.\n  [o   o]  ·\n  /|━━━|━━o\n   o   o  💥",
  "  .-----.\n  [-   -]\n  /|━━━|━━o\n   o   o  ✨",
  "  .-----.\n  [o   o]\no━━|━━━|\\\n🔥 o   o",
  "  .-----.\n· [o   o]\no━━|━━━|\\\n💥 o   o",
  "  .-----.\n  [-   -]\no━━|━━━|\\\n✨ o   o",
  "         .-----.\n|_|--  🏀[⌐   ⌐]\n |       ━|━━━|\\\n |        o   o",
  "     🏀  .-----.\n|_|--    [⌐   ⌐]\n |       ━|━━━|\\\n |        o   o",
  "   🏀    .-----.\n|_|--    [⌐   ⌐]\n |       /|━━━|\\\n |        o   o",
  "         .-----.\n|_|🏀    [⌐   ⌐]\n |       /|━━━|\\\n |        o   o",
  "         .-----.\n|_|--    [^   ^]\n |🏀     /|━━━|\\\n |        o   o",
  "         .-----.\n|_|--  ✨[^   ^]\n |       /|━━━|\\\n |🏀      o   o",
  "  .-----.\n  [o   o]\n  /|━━━|━━━\\\n   o   o  ~~o~~",
  "  .-----.\n  [-   -]\n  /|━━━|━━━\\\n   o   o  ~~~~~",
  "  .-----.  🐟\n  [^   ^]━━/✨\n  /|━━━|\n   o   o  ~~~~~",
  "         .-----.\n         [o   o]\n      /━━━|━━━|\\\n   ~~o~~  o   o",
  "         .-----.\n         [-   -]\n      /━━━|━━━|\\\n   ~~~~~  o   o",
  "     🐟  .-----.\n    ✨\\━━[^   ^]\n          |━━━|\\\n   ~~~~~  o   o",
  "  .-----.\n  [-   -] ~\n  /|━━━|━☕\n   o   o",
  "  .-----.\n  [-   -]  ~\n  /|━━━|━☕\n   o   o",
  "  .-----.\n  [-   -]☕\n  /|━━━|/\n   o   o",
  "  .-----.\n  [O   O]\n  /|━━━|━☕\n   o   o",
  "         .-----.\n       ~ [-   -]\n       ☕━|━━━|\\\n          o   o",
  "         .-----.\n      ~  [-   -]\n       ☕━|━━━|\\\n          o   o",
  "         .-----.\n       ☕[-   -]\n         \\|━━━|\\\n          o   o",
  "         .-----.\n         [O   O]\n       ☕━|━━━|\\\n          o   o",
  "  .-----.\n  [o   o]\n  /|━━━|━o·\n   o   o  🌱",
  "  .-----.\n  [o   o]\n  /|━━━|━o\n   o   o  🌱",
  "  .-----.\n  [o   o]\n  /|━━━|━o·\n   o   o  🌿",
  "  .-----.\n  [o   o]\n  /|━━━|━o\n   o   o  🌿",
  "  .-----.\n  [^   ^]\n  /|━━━|\\\n   o   o  🌻",
  "         .-----.\n         [o   o]\n       ·o━|━━━|\\\n      🌱  o   o",
  "         .-----.\n         [o   o]\n        o━|━━━|\\\n      🌱  o   o",
  "         .-----.\n         [o   o]\n       ·o━|━━━|\\\n      🌿  o   o",
  "         .-----.\n         [o   o]\n        o━|━━━|\\\n      🌿  o   o",
  "         .-----.\n         [^   ^]\n         /|━━━|\\\n      🌻  o   o",
  "  .-----.  🎈\n  [o   o] /\n  /|━━━|━o\n   o   o",
  "  .-----.  🎈\n  [O   O] /\n  /|━━━|━o\n   '   '",
  "     🎈  .-----.\n       \\ [o   o]\n        o━|━━━|\\\n          o   o",
  "     🎈  .-----.\n       \\ [O   O]\n        o━|━━━|\\\n          '   '",
  "  .-----.\n  [o   o]    ______\n  /|━━━|\\    |: : :|\n   o   o ⚽  |     |",
  "  .-----.\n  [o   o]    ______\n  /|━━━|\\    |: : :|\n   o  /    ⚽|     |",
  "  .-----.\n  [o   o]    ______\n  /|━━━|\\    |: : :|\n   o   o     | ⚽  |",
  " \\.-----./\n  [^   ^]    ______\n   |━━━|     |: : :|\n   o   o     | ⚽  |",
  "             .-----.\n______       [o   o]\n|: : :|      /|━━━|\\\n|     |    ⚽ o   o",
  "             .-----.\n______       [o   o]\n|: : :|      /|━━━|\\\n|     |  ⚽   \\   o",
  "             .-----.\n______       [o   o]\n|: : :|      /|━━━|\\\n|  ⚽ |       o   o",
  "            \\.-----./\n______       [^   ^]\n|: : :|       |━━━|\n|  ⚽ |       o   o",
  "      .-----.\n      [o   o]\n    🎤━|━━━|\\\n       o   o",
  "      .-----.\n  🎵  [o   o]\n    🎤━|━━━|\\\n       o   o",
  "🎵     .-----.\n  🎶  [^   ^]\n    🎤━|━━━|\\\n       o   o",
  "🎶     .-----.\n  🎵  [^   ^]\n    🎤━|━━━|\\\n       o   o",
  "        \\.-----./\n         [O   O]\n          |━━━|\n          o   o",
  " \\.-----./\n  [^   ^]\n   |━━━|    📷\n   o   o    /|",
  " \\.-----./\n  [O   O]   ✨\n   |━━━|    📸\n   o   o    /|",
  "  .-----.\n  [o   o]\n  /|━━━|o   📷\n   o   o    /|",
  "  .-----.\n  [O   O]   ✨\n  /|━━━|o   📸\n   o   o    /|",
  "  .-----.\n  [^   ^]\n  o|━━━|o   📷\n   o   o    /|",
  "  .-----.\n  [O   O]   ✨\n  o|━━━|o   📸\n   o   o    /|",
  "  .-----.\\o\n  [o   o]\n   |━━━|    📷\n   o   o    /|",
  "  .-----.\\o\n  [O   O]   ✨\n   |━━━|    📸\n   o   o    /|",
  "        \\.-----./\n         [^   ^]\n   📷     |━━━|\n   /|     o   o",
  "        \\.-----./\n   ✨    [O   O]\n   📸     |━━━|\n   /|     o   o",
  "         .-----.\n         [o   o]\n   📷    o|━━━|\\\n   /|     o   o",
  "         .-----.\n   ✨    [O   O]\n   📸    o|━━━|\\\n   /|     o   o",
  "         .-----.\n         [^   ^]\n   📷    o|━━━|o\n   /|     o   o",
  "         .-----.\n   ✨    [O   O]\n   📸    o|━━━|o\n   /|     o   o",
  "       o/.-----.\n         [o   o]\n   📷     |━━━|\n   /|     o   o",
  "       o/.-----.\n   ✨    [O   O]\n   📸     |━━━|\n   /|     o   o",
]

/** Random states, in the same order as the `states` array in crazy-robot. */
export const STATES = [
  'static', 'blink', 'wave', 'sleep', 'surprise', 'smile', 'dance', 'jump', 'moon', 'catpeek',
  'basketball', 'campfire', 'fishing', 'coffee', 'garden', 'balloon', 'goal', 'concert', 'ufo', 'photo',
]

const WIDTH: Record<string, number> = {
  moon: 20, basketball: 18, ufo: 18, goal: 21, balloon: 16, photo: 16, fishing: 16,
  campfire: 13, coffee: 13, garden: 13, concert: 14,
}

const COLOR: Record<string, number> = {
  walk: 208, static: 244, blink: 214, wave: 220, surprise: 214, smile: 213, sleep: 63, moon: 75,
  catpeek: 213, basketball: 214, campfire: 203, fishing: 39, coffee: 130, garden: 114, balloon: 219,
  goal: 82, concert: 135, photo: 231, ufo: 51,
}

const RAINBOW = [208, 220, 46, 51, 75, 99, 165, 213]
const MOON_PHASES = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']

/** How many ticks a state plays; `random()` is rolled once, like `RANDOM` in zsh. */
function durOf(state: string, random: () => number): number {
  const r = () => random()
  switch (state) {
    case 'walk': return 12 + (r() % 16)
    case 'static': case 'wave': case 'smile': return 12 + (r() % 10)
    case 'sleep': return 16 + (r() % 12)
    case 'surprise': return 6 + (r() % 6)
    case 'blink': case 'dance': return (6 + (r() % 6)) * 2
    case 'jump': return (12 + (r() % 6)) * 2
    case 'moon': return (6 + (r() % 4)) * 6
    case 'catpeek': return (2 + (r() % 2)) * 8
    case 'basketball': return (2 + (r() % 3)) * 6
    case 'campfire': return (4 + (r() % 4)) * 3
    case 'fishing': case 'coffee': case 'garden': return (1 + (r() % 2)) * 12
    case 'balloon': return 999
    case 'goal': return (1 + (r() % 2)) * 8
    case 'concert': return (3 + (r() % 3)) * 4
    case 'photo': return (2 + (r() % 2)) * 8
    case 'ufo': return 999
    default: return 8 + (r() % 18)
  }
}

const sp = (n: number) => ' '.repeat(Math.max(0, n))
const idle = (n: number) => IDLE_FRAMES[n - 1] ?? ''

/** Turns the raw rows into a frame: pad, orange body, state colour inside [...]. */
function paint(raw: string, pos: number, color: number): Frame {
  const pad = sp(pos)
  const body = raw.replaceAll('\n', `\n${pad}`)
  const orange = `\x1b[38;5;${ORANGE_INDEX}m`
  const accent = `\x1b[38;5;${color}m`
  const highlighted = body.replace(/\[([^\]]*)\]/g, (_, inner: string) => `[${accent}${inner}${orange}]`)
  const rows = `${orange}${pad}${highlighted}\x1b[39m`.split('\n')
  return rows.map(spansOf)
}

/** The raw rows of a state at its current tick; may also move pos, mirror and dur. */
function drawOf(s: RobotState, track: number, random: () => number): { raw: string; pad: number } {
  const { state: name, t } = s
  const reroll = () => {
    if (t === 0) s.mirror = (random() % 2) as 0 | 1
  }
  switch (name) {
    case 'walk': {
      s.pos += s.dir
      if (s.pos >= track - 1) { s.pos = track - 1; s.dir = -1 }
      if (s.pos <= 0) { s.pos = 0; s.dir = 1 }
      return { raw: WALK_FRAMES[t % 2] ?? '', pad: s.pos }
    }
    case 'static': return { raw: WALK_FRAMES[0] ?? '', pad: s.pos }
    case 'blink': return { raw: idle(t % 2 === 0 ? 1 : 2), pad: s.pos }
    case 'wave': return { raw: idle(3), pad: s.pos }
    case 'surprise': return { raw: idle(4), pad: s.pos }
    case 'smile': return { raw: idle(5), pad: s.pos }
    case 'sleep': return { raw: idle(7), pad: s.pos }
    case 'dance': return { raw: idle(t % 2 === 0 ? 6 : 2), pad: s.pos }
    case 'jump': return { raw: idle(t % 2 === 0 ? 9 : 10), pad: s.pos }
    case 'moon': {
      reroll()
      const mp = MOON_PHASES[Math.floor(t / 3) % MOON_PHASES.length]
      let eyesR = '- - O'
      let eyesL = 'O - -'
      let spark = ' '
      if (t % 6 === 5) { eyesR = '- - -'; eyesL = '- - -'; spark = '·' }
      const raw = s.mirror
        ? [`${mp}    ${spark}     .-----.`, `     o==    [${eyesL}]`, '       |    /|━━━|\\', '      / \\    o   o']
        : [`  .-----.   ${spark}     ${mp}`, `  [${eyesR}]    ==o`, '  /|━━━|\\    |', '   o   o    / \\']
      return { raw: raw.join('\n'), pad: s.pos }
    }
    case 'catpeek': {
      const phase = t % 8
      if (phase === 0) s.pos = random() % Math.max(1, track - 10)
      const n = phase === 2 || phase === 4 ? 14 : phase === 3 || phase === 5 ? 15 : 13
      return { raw: idle(n), pad: s.pos }
    }
    case 'basketball': reroll(); return { raw: idle((s.mirror ? 28 : 16) + (t % 6)), pad: s.pos }
    case 'campfire': reroll(); return { raw: idle((s.mirror ? 25 : 22) + (t % 3)), pad: s.pos }
    case 'fishing': {
      reroll()
      const base = s.mirror ? 37 : 34
      const p = t % 12
      return { raw: idle(p >= 4 ? base + 2 : base + (p % 2)), pad: s.pos }
    }
    case 'coffee': {
      reroll()
      const base = s.mirror ? 44 : 40
      const p = t % 12
      return { raw: idle(p < 6 ? base + Math.floor(p / 3) : p < 9 ? base + 2 : base + 3), pad: s.pos }
    }
    case 'garden': {
      reroll()
      const base = s.mirror ? 53 : 48
      const p = t % 12
      return { raw: idle(p < 8 ? base + Math.floor(p / 4) * 2 + (p % 2) : base + 4), pad: s.pos }
    }
    case 'balloon': reroll(); return balloonOf(s, track)
    case 'goal': {
      reroll()
      const base = s.mirror ? 66 : 62
      const p = t % 8
      return { raw: idle(p <= 1 ? base : p <= 3 ? base + p - 1 : base + 3), pad: s.pos }
    }
    case 'concert': return { raw: idle(70 + (t % 4)), pad: s.pos }
    case 'ufo': return ufoOf(s)
    case 'photo': reroll(); return { raw: idle((s.mirror ? 83 : 75) + (t % 8)), pad: s.pos }
    default: return { raw: '', pad: s.pos }
  }
}

/** Balloon: held, lifted, then drifting off while the robot watches. */
function balloonOf(s: RobotState, track: number): { raw: string; pad: number } {
  const { t } = s
  const base = s.mirror ? 60 : 58
  if (t < 4) return { raw: idle(base + Math.floor(t / 2)), pad: s.pos }
  const drift = (t - 4) * 2
  const rel = s.mirror ? 3 - drift : 13 + drift
  const gone = s.mirror ? s.pos + rel < 0 : s.pos + rel + 2 > track
  if (gone) {
    let raw = idle(7)
    if (s.mirror) raw = `       ${raw.replaceAll('\n', '\n       ')}`
    if (s.dur > t + 3) s.dur = t + 3
    return { raw, pad: s.pos }
  }
  if (s.mirror) {
    const abs = s.pos + rel
    const padTo = s.pos + 7
    const row = sp(padTo + 2)
    const raw = [`${sp(abs)}🎈${sp(padTo - abs - 2)}o/.-----.`, `${row}[O   O]`, `${row} |━━━|`, `${row} o   o`]
    return { raw: raw.join('\n'), pad: 0 }
  }
  const raw = [`  .-----.\\o${sp(rel - 11)}🎈`, '  [O   O]', '   |━━━|', '   o   o']
  return { raw: raw.join('\n'), pad: s.pos }
}

/** UFO: abducts a cow on the robot's left; every row is in absolute columns. */
function ufoOf(s: RobotState): { raw: string; pad: number } {
  const { t, pos } = s
  const meet = Math.max(1, Math.trunc((pos + 6) / 2))
  const arrive = Math.max(1, pos + 6 - meet)
  const ut = t - arrive
  const pre = sp(pos + 9)
  const body = `${pre}/|━━━|\\`
  const feet = `${pre} o   o`
  const rows = (...r: string[]) => ({ raw: r.join('\n'), pad: 0 })
  if (ut < 0) {
    const ufo = Math.trunc((meet * t) / arrive)
    const cow = pos + 6 - t
    return rows(
      `${sp(ufo)}🛸${sp(pos + 7 - ufo)}.-----.`,
      `${pre}[o   o]`,
      body,
      `${sp(cow)}🐄${sp(pos + 8 - cow)}o   o`,
    )
  }
  if (ut === 0) {
    return rows(
      `${sp(meet)}🛸${sp(pos + 7 - meet)}.-----.`,
      `${pre}[o   o]`,
      body,
      `${sp(meet)}🐄${sp(pos + 8 - meet)}o   o`,
    )
  }
  if (ut === 1) {
    return rows(
      `${sp(meet)}🛸${sp(pos + 7 - meet)}.-----.`,
      `${sp(meet - 1)}\\  /${sp(pos + 6 - meet)}[O   O]`,
      body,
      `${sp(meet)}🐄${sp(pos + 8 - meet)}o   o`,
    )
  }
  if (ut === 2) {
    return rows(
      `${sp(meet)}🛸${sp(pos + 7 - meet)}.-----.`,
      `${sp(meet - 1)}\\  /${sp(pos + 6 - meet)}[O   O]`,
      `${sp(meet)}🐄${sp(pos + 7 - meet)}/|━━━|\\`,
      feet,
    )
  }
  if (ut === 3) {
    return rows(
      `${sp(meet)}🛸${sp(pos + 7 - meet)}.-----.`,
      `${sp(meet)}🐄${sp(pos + 7 - meet)}[O   O]`,
      body,
      feet,
    )
  }
  const ufo = meet - (ut - 4) * 3
  if (ufo < 0) {
    // Shocked hold: a plain frame, so the normal pos padding applies.
    if (s.dur > t + 3) s.dur = t + 3
    return { raw: idle(74), pad: pos }
  }
  if (t % 2) {
    return rows(
      `${sp(ufo)}🛸${sp(pos + 6 - ufo)}\\.-----./`,
      `${pre}[O   O]`,
      `${pre} |━━━|`,
      feet,
    )
  }
  return rows(
    `${sp(ufo)}🛸${sp(pos + 7 - ufo)}.-----.`,
    `${pre}[O   O]`,
    body,
    feet,
  )
}

/** One tick of crazy-robot: the frame it prints and the state after. `random()` is like zsh $RANDOM (0..32767). */
export function step(state: RobotState, track: number, random: () => number): { frame: Frame; state: RobotState } {
  const s: RobotState = { ...state }
  const width = Math.max(1, track)

  if (s.t >= s.dur) {
    if (s.state !== 'walk') {
      s.state = 'walk'
    } else {
      s.state = STATES[random() % STATES.length] ?? 'static'
    }
    s.t = 0
    const w = WIDTH[s.state] ?? 0
    if (w) {
      if (s.pos > width - w) s.pos = width - w
      if (s.pos < 0) s.pos = 0
    }
    s.dur = durOf(s.state, random)
  }

  const color = s.state === 'dance' || s.state === 'jump' ? (RAINBOW[s.t % RAINBOW.length] ?? ORANGE_INDEX) : (COLOR[s.state] ?? ORANGE_INDEX)
  const { raw, pad } = drawOf(s, width, random)
  const frame = paint(raw, pad, color)
  s.t += 1
  return { frame, state: s }
}

/** Like zsh $RANDOM: an int in 0..32767. */
export const randomInt = (): number => Math.floor(Math.random() * 32768)

/** `count` frames of the robot on a track this many cells wide. */
export function filmOf(track: number, count: number, random: () => number = randomInt): Frame[] {
  const frames: Frame[] = []
  let state = INITIAL
  for (let i = 0; i < count; i++) {
    const next = step(state, track, random)
    frames.push(next.frame)
    state = next.state
  }
  return frames
}
