import { ACT_DUR, ACT_WIDTH, actFrameOf } from './acts'
import { ORANGE_INDEX, spansOf } from './frames'
import type { Frame } from './frames'

// A TypeScript twin of functions/crazy-robot: the same states, timings,
// frames and colours, drawn without zsh. Keep the two in step; robot.test.ts
// runs the real zsh and compares every frame.

/** Where the robot is in its show: which state, how far in, where it stands. */
export type RobotState = { state: string; t: number; dur: number; pos: number; dir: 1 | -1; mirror: 0 | 1; value?: number }

/** Acts play on command (/robot play, dice, coin), never on the random schedule. */
export type ActName = 'slot' | 'dice' | 'coin'
export const ACTS: readonly ActName[] = ['slot', 'dice', 'coin']

/** True while a command-triggered act plays. */
export function isActing(s: RobotState): boolean {
  return ACTS.includes(s.state as ActName) && s.t < s.dur
}

/** Starts an act now: t 0, its own dur, `value` set, pos clamped so the act fits. */
export function actOf(state: RobotState, name: ActName, value: number, track: number): RobotState {
  const width = ACT_WIDTH[name]
  // The die always starts at the left edge and rolls to the middle.
  const pos = name === 'dice' ? 0 : width > 0 ? Math.min(Math.max(0, state.pos), Math.max(0, track - width)) : state.pos
  return { ...state, state: name, t: 0, dur: ACT_DUR[name], pos, value }
}

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
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
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
  " \\.-----./\n  [-   -]\n   |━━━|\n   o   o",
  " \\.-----./\n  [-   -]\n   |━━━|\n   o   o",
  " \\.-----./\n  [-   -]\n   |━━━|\n   '   '",
  "  .-----.\n  [- - -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [^   ^]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [^   ^]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
  "    .-----.\n [o   o]\n   /|━━━|\\\n   o   o",
  ".-----.\n   [o   o]\n /|━━━|\\\n     o   o",
  "  .--▓▒░░\n  [▒   ▓]\n   /|━━━|\\\n    o   o",
  "  ░▒▓▓▒░▒\n  ▓▒░▒▓▒░\n  ░|▒▓▒|▓\n   ▒   ░",
  "  .-----.\n  [o   o]\n     /|━━━|\\\n      o   o",
  "\n  ▒▒▒▒▒▒▒\n\n",
  "\n      ▒\n\n",
  "  .-----.\n  [▮▮▯▯▯]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [▮▮▮▮▮]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [-   -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [   oo]\n   |━━━|\n    o o",
  "  .-----.\n  [     ]\n  \\|━━━|/\n   o   o",
  "  .-----.\n  [oo   ]\n   |━━━|\n    o o",
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [     ]\n  \\|━━━|/\n   o   o",
  "  .-----.\n  [o o o]\n  /|━━━|\\\n   o   o",
  " .-----.\n [@   @]\n  /|━━━|\\\n   o   o",
  "   .-----.\n   [@   @]\n  /|━━━|\\\n o   o",
  " .-----.\n [x   x]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [@   @]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [-   -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [-   o]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [>   -]\n  \\|━━━|/\n   o   o",
  "  .-----.\n  [>   <]\n  \\|━━━|/\n   o   o",
  ".-----.   '  .\n[>   <]  * ' *\n\\|━━━|/   , .\n o   o",
  ".-----.         '    .\n[>   <]    *    ,   *\n\\|━━━|/      .   '\n o   o",
  " .-----.             .\n [-   -]         '    ,   .\n /|━━━|\\       .    '\n  o   o",
  "  .-----.\n  [-   -]                   .\n  /|━━━|\\      .       '\n   o   o",
  "  .-----.\n  [-   -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [oo   ]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [   oo]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [-   -]\n  /|━━━|\\\n   o   o",
  "' .-----.  .\n  [o   o]\n  /|━━━|\\\n   o   o",
  "* .-----.    *\n' [o   o]  .\n  /|━━━|\\\n   o   o",
  "* .-----. '\n. [^   ^]    .\n' /|━━━|\\  *\n   o   o",
  "' .--*--.\n. [^   ^]   *\n* /|━━━|\\    '\n   o   o   .",
  ". .-*.*-.   '\n  [^   ^]\n' /|━━━|\\   .\n . o   o     *",
  "* .*****.    '\n  [^   ^]  *\n. /|━━━|\\\n   o   o    .",
  "  .*****.  .\n* [^   ^]\n  /|━━━|\\    .\n'  o   o",
  "  .*****.\n  [-   -]   '\n. /|━━━|\\\n   o   o    .",
  " .*-*-*. *\n [-   -]  ' .\n /|━━━|\\\n  o   o",
  "*  .-*-*-.  .\n'  [-   -]\n . /|━━━|\\ '\n    o   o",
  " .-----.   *\n [-   -]  '\n /|━━━|\\    .\n  o   o",
  "  .-----.\n  [o   o]\n  /|━━━|\\    '\n   o   o   .",
  "  .-----. *\n  [o   o]\n  /|━━━|━━o\n   o   o",
  "  .-----.\n  [o   o] *\n  /|━━━|━━o\n   o   o",
  "  .-----.\n  [^   ^]\n  /|━━━|━━*\n   o   o",
  "  .-----.\n  [-   -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o] o\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [-   -] O\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o] ( )\n  /|━━━|\\\n   o   o",
  "  .-----. .---.\n  [O   O] (   )\n  /|━━━|\\ '---'\n   o   o",
  "  .-----. .-----.\n  [O   O] (     )\n  /|━━━|\\ '-----'\n   o   o",
  "  .-----. .-------.\n  [ O O ] (       )\n  /|━━━|\\ '-------'\n   o   o",
  "  .-----. .---------.\n  [ o o ] (         )\n  /|━━━|\\ '---------'\n   o   o",
  "  .-----.   '   .   ,\n  [O   O]  ,  '  .  '\n  /|━━━|\\  .   '   ,\n   o   o     '   .",
  "  .-----.       '  .\n  [~~~~~]     ,\n  /|━━━|\\    ,  .\n   o   o        .",
  "  .-----.\n  [~~~~~]\n  /|━━━|\\          '\n   o   o           .",
  "  .-----.\n  [~~~~~]━\n  /|━━━|/\n   o   o",
  "  .-----.\n  [~~   ]━━\n  /|━━━|/\n   o   o",
  "  .-----.\n  [o   o]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [-   -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o] o\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [-   -] O\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [o   o] ( )\n  /|━━━|\\\n   o   o",
  "  .-----. .---.\n  [O   O] (   )\n  /|━━━|\\ '---'\n   o   o",
  "  .-----. .-----.\n  [ O O ] (     )\n  /|━━━|\\ (     )\n   o   o  '-----'",
  "  .-----. ' .-----. .\n  [O   O]  .(     ) ,\n  /|━━━|\\ , (     ) '\n   o   o   ''-----' .",
  "  .-----.   .-----.\n  [O   O]   [oo   ] .\n  /|━━━|\\   (     )\n   o   o  ' '-----'",
  "  .-----.   .-----.\n  [   oo]   [oo   ]\n  /|━━━|\\   /|━━━|\\ ,\n   o   o    '-----'",
  "  .-----.   .-----.\n  [   oo]   [oo   ]\n  /|━━━|\\   /|━━━|\\\n   o   o     o   o",
  "  .-----.\\o .-----.\n  [   oo]   [oo   ]\n   |━━━|    /|━━━|\\\n   o   o     o   o",
  "  .-----.\\o .-----.\\o\n  [   oo]   [oo   ]\n   |━━━|     |━━━|\n   o   o     o   o",
  "  .-----.   .-----.\n  [^   ^]   [oo   ]\n   |━━━|    /|━━━|\\\n   '   '     o   o",
  "  .-----.   .-----.\n  [   oo]   [^   ^]\n  /|━━━|\\    |━━━|\n   o   o     '   '",
  "  .-----.   .-----.\\o\n  [O   O]   [o   -]\n  /|━━━|\\    |━━━|\n   o   o     o   o",
  "  .-----.    '  .  ,\n  [O   O]   .  *  '\n  /|━━━|\\    ,   .  *\n   o   o    '   ,  .",
  "  .-----.  .        '\n  [O   O]\n  /|━━━|\\      ,\n   o   o            .",
  "  .-----.\n  [O   O]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [-   -]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [O   O]\n  /|━━━|\\\n   o   o",
  "  .-----.\n  [>   <]\n  \\|━S━|/\n   o   o",
  "  .-----. o\n  [O   O]/\n  /|━S━|\n   o   o",
  "     .-----.\n  ___[O   O]\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[O   O]             🎯\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[*   *]             🎯\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[*   *]=====        🎯\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[*   *]==========   🎯\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[*   *]=============🎯\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[O   O]             💥\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[O   O]\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[O   O]\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[O   O]        🎯\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[*   *]        🎯\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[*   *]====    🎯\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[*   *]========🎯\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[O   O]        💥\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[O   O]\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[O   O]\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[O   O]     🎯      🎯\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[*   *]     🎯      🎯\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[*   *]=====🎯      🎯\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[*   *]=====💥===   🎯\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[*   *]=====  ======🎯\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[O   O]             💥\n \\___/|━S━|\n       '  '",
  "     .-----.\n  ___[O   O]\n /___/|━S━|\n       '  '",
  "     .-----.\n ____[O   O]\n \\___/|━S━|\\\n      o   o",
  "     .-----. o\n  ___[^   ^]/\n /___/|━S━|\n      o   o",
  "     .-----. o\n ____[^   -]/\n \\___/|━S━|\n      o   o",
]

/** Random states, in the same order as the `states` array in crazy-robot. */
export const STATES = [
  'static', 'blink', 'wave', 'sleep', 'surprise', 'smile', 'dance', 'jump', 'moon', 'catpeek',
  'basketball', 'campfire', 'fishing', 'coffee', 'garden', 'balloon', 'goal', 'concert', 'ufo', 'photo',
  'stretch', 'glitch', 'spin', 'sneeze', 'snow', 'gum', 'clone', 'super',
]

const WIDTH: Record<string, number> = {
  moon: 20, basketball: 18, ufo: 18, goal: 21, balloon: 16, photo: 16, fishing: 16,
  campfire: 13, coffee: 13, garden: 13, concert: 14, glitch: 12, sneeze: 29, snow: 15, gum: 21, clone: 21, super: 27,
}

const COLOR: Record<string, number> = {
  walk: 208, static: 244, blink: 214, wave: 220, surprise: 214, smile: 213, sleep: 63, moon: 75,
  catpeek: 213, basketball: 214, campfire: 203, fishing: 39, coffee: 130, garden: 114, balloon: 219,
  goal: 82, concert: 135, photo: 231, ufo: 51, stretch: 180, glitch: 46, spin: 159, sneeze: 210, snow: 195, gum: 213, clone: 87, super: 196,
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
    case 'stretch': return (2 + (r() % 2)) * 6
    case 'glitch': return (1 + (r() % 2)) * 12
    case 'spin': return (1 + (r() % 2)) * 12
    case 'sneeze': return (1 + (r() % 2)) * 12
    case 'snow': return (1 + (r() % 2)) * 16
    case 'gum': return (1 + (r() % 2)) * 14
    case 'clone': return (1 + (r() % 2)) * 18
    case 'super': return (1 + (r() % 2)) * 29
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
  const highlighted = body.replace(/\[(.*)\]/g, (_, inner: string) => `[${accent}${inner}${orange}]`)
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
    case 'ufo': return ufoOf(s, track, random)
    case 'stretch': return { raw: idle(91 + (t % 6)), pad: s.pos }
    case 'glitch': return { raw: idle(97 + (t % 12)), pad: s.pos }
    case 'spin': return { raw: idle(109 + (t % 12)), pad: s.pos }
    case 'sneeze': return { raw: idle(121 + (t % 12)), pad: s.pos }
    case 'snow': return { raw: idle(133 + (t % 16)), pad: s.pos }
    case 'gum': return { raw: idle(149 + (t % 14)), pad: s.pos }
    case 'clone': return { raw: idle(163 + (t % 18)), pad: s.pos }
    case 'super': return { raw: idle(181 + (t % 29)), pad: s.pos }
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

type Piece = [col: number, text: string, cells: number]

/** One row from pieces sorted by column. */
function lay(...pieces: Piece[]): string {
  let row = ''
  let x = 0
  for (const [col, text, cells] of pieces) {
    row += sp(col - x) + text
    x = col + cells
  }
  return row
}

/** How far right the robot walks before the ufo scene, so the woods on its left hold 5 trees. */
const UFO_ROOM = 28

/**
 * UFO, a little movie on the robot's left: first the robot walks right until
 * the woods have room, then a cow walks deep into them (behind the trees) to a
 * random gap, the 🛸 races in (2 cells a tick to the cow's 1), beams it up and
 * zooms off while the robot panics. Every row is in absolute columns.
 */
function ufoOf(s: RobotState, track: number, random: () => number): { raw: string; pad: number } {
  if (s.t === 0) {
    s.value = random()
    // Walk in: t stays at 0 until the robot has room. Drawn 7 cells right, where the scene draws it.
    if (s.pos < Math.min(UFO_ROOM, track - 18)) {
      s.pos += 1
      s.t = -1
      return { raw: `       ${(WALK_FRAMES[s.pos % 2] ?? '').replaceAll('\n', '\n       ')}`, pad: s.pos }
    }
  }
  const { t, pos } = s
  // A tree every 7 cols up to the cow's start; the cow is taken in the gap
  // left by a random tree `gap`, at least two trees short of the robot.
  const count = Math.floor(pos / 7) + 1
  const gap = count >= 3 ? (s.value ?? 0) % (count - 2) : -1
  const meet = gap >= 0 ? 3 + 7 * gap : Math.max(2, pos - 4)
  const arrive = Math.max(pos + 6 - meet, Math.ceil(meet / 2))
  const ut = t - arrive
  // Met 2 ticks, the beam 1 tick a step, the sparkle 2 ticks.
  const beat = ut < 0 ? -1 : ut < 2 ? 0 : ut < 5 ? ut - 1 : ut < 7 ? 4 : 5
  const head = pos + 9
  const tops: Piece[] = []
  const trunks: Piece[] = []
  for (let i = 0; gap >= 0 && i < count; i++) {
    if (i === gap) continue
    const c = 2 + 7 * i
    if (i % 3 === 0) tops.push([c, '🌲', 2])
    trunks.push([c, i % 3 === 2 ? '🌳' : '🌲', 2])
  }
  const top = (...p: Piece[]): Piece[] => [...p, [head, '.-----.', 7]]
  const eyes = (e: string, ...p: Piece[]): Piece[] => [...p, [head, `[${e}   ${e}]`, 7]]
  const body = (...p: Piece[]): Piece[] => [...[...tops, ...p].sort((x, y) => x[0] - y[0]), [head, '/|━━━|\\', 7]]
  // The cow hides behind a tree it walks past.
  const feet = (cow = -9): Piece[] => {
    const hid = trunks.some(([c]) => Math.abs(c - cow) <= 1)
    const left = trunks.filter(([c]) => c < cow)
    const ground: Piece[] = cow < 0 || hid ? trunks : [...left, [cow, '🐄', 2], ...trunks.slice(left.length)]
    return [...ground, [head + 1, 'o   o', 5]]
  }
  const rows = (...r: Piece[][]) => ({ raw: r.map(p => lay(...p)).join('\n'), pad: 0 })
  const ship: Piece = [meet, '🛸', 2]
  if (ut < 0) {
    const ufo = meet - 2 * (arrive - t)
    return rows(ufo < 0 ? top() : top([ufo, '🛸', 2]), eyes('o'), body(), feet(Math.max(meet, pos + 6 - t)))
  }
  if (beat === 0) return rows(top(ship), eyes('O'), body(), feet(meet))
  if (beat === 1) return rows(top(ship), eyes('O', [meet - 1, '/  \\', 4]), body([meet - 2, '/    \\', 6]), feet(meet))
  if (beat === 2) return rows(top(ship), eyes('O', [meet - 1, '/  \\', 4]), body([meet - 2, '/ 🐄 \\', 6]), feet())
  if (beat === 3) return rows(top(ship), eyes('O', [meet - 1, '/🐄\\', 4]), body([meet - 2, '/    \\', 6]), feet())
  if (beat === 4) return rows(top(ship, [meet + 2, '✨', 2]), eyes('O'), body(), feet())
  const ufo = meet - 3 * (ut - 6)
  const panic = (...p: Piece[]): Piece[] => [...p, [pos + 8, '\\.-----./', 9]]
  const arms = (): Piece[] => [...tops, [pos + 10, '|━━━|', 5]]
  if (ufo < 0) {
    // Shocked hold: arms up over the empty gap.
    if (s.dur > t + 3) s.dur = t + 3
    return rows(panic(), eyes('O'), arms(), feet())
  }
  if (t % 2) return rows(panic([ufo, '🛸', 2]), eyes('O'), arms(), feet())
  return rows(top([ufo, '🛸', 2]), eyes('O'), body(), feet())
}

/** Starts animation `name` now: t 0, its own dur, pos clamped so a wide prop fits. */
export function animationOf(state: RobotState, name: string, track: number, random: () => number): RobotState {
  const s: RobotState = { ...state, state: name, t: 0 }
  const w = WIDTH[name] ?? 0
  if (w) {
    if (s.pos > track - w) s.pos = track - w
    if (s.pos < 0) s.pos = 0
  }
  s.dur = durOf(name, random)
  return s
}

/** One tick of crazy-robot: the frame it prints and the state after. `random()` is like zsh $RANDOM (0..32767). */
export function step(state: RobotState, track: number, random: () => number, pool: readonly string[] = STATES): { frame: Frame; state: RobotState } {
  const s: RobotState = { ...state }
  const width = Math.max(1, track)

  if (s.t >= s.dur) {
    const next = s.state !== 'walk' ? 'walk' : (pool[random() % pool.length] ?? 'static')
    Object.assign(s, animationOf(s, next, width, random))
  }

  if (ACTS.includes(s.state as ActName)) {
    const frame = actFrameOf(s, width, random)
    s.t += 1
    return { frame, state: s }
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
