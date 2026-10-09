import { MAX_FRIENDS } from './friends'
import type { Friend } from './friends'

/** One run of text in one colour. */
export type Span = { text: string; color: string }

/** One robot frame: its rows, each a list of coloured spans. */
export type Frame = Span[][]

/** Separates frames in the generator's output. */
export const FRAME_SEPARATOR = '\x1e'

/** xterm index of the robot's orange body. */
export const ORANGE_INDEX = 208
const CUBE = [0, 95, 135, 175, 215, 255]
const BASIC = [
  '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
  '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
]

/** Maps an xterm 256-colour index to a hex colour. */
export function hexOf(index: number): string {
  if (index < 16) return BASIC[index] ?? hexOf(ORANGE_INDEX)
  const hex = (n: number | undefined) => (n ?? 0).toString(16).padStart(2, '0')
  if (index >= 232) {
    const grey = 8 + (index - 232) * 10
    return `#${hex(grey)}${hex(grey)}${hex(grey)}`
  }
  const cube = index - 16
  return `#${hex(CUBE[Math.floor(cube / 36)])}${hex(CUBE[Math.floor(cube / 6) % 6])}${hex(CUBE[cube % 6])}`
}

/** Splits one ANSI-coloured row into spans; drops clear-line and column moves. */
export function spansOf(row: string): Span[] {
  const spans: Span[] = []
  let color = hexOf(ORANGE_INDEX)
  let last = 0
  for (const match of row.matchAll(/\x1b\[(?:38;5;(\d+)m|39m|K|\d+G)/g)) {
    const at = match.index ?? 0
    if (at > last) spans.push({ text: row.slice(last, at), color })
    if (match[1] !== undefined) color = hexOf(Number(match[1]))
    last = at + match[0].length
  }
  if (last < row.length) spans.push({ text: row.slice(last), color })
  return spans
}

/** Parses the generator's whole output into frames of four rows each. */
export function framesOf(output: string): Frame[] {
  return output
    .split(FRAME_SEPARATOR)
    .filter(chunk => chunk.length > 0)
    .map(chunk => chunk.replace(/\n$/, '').split('\n').map(spansOf))
}

/** Terminal cells a string takes: emoji count two. */
export function cellsOf(text: string): number {
  let cells = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    cells += code >= 0x1f000 || [0x2615, 0x26bd, 0x2728].includes(code) ? 2 : 1
  }
  return cells
}

/** Width of one terminal cell, in CSS px, when the robot is drawn as SVG. */
export const CELL_WIDTH = 8.4
/** Height of one row, in CSS px, when the robot is drawn as SVG. */
export const ROW_HEIGHT = 17
const FONT_SIZE = 14
const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Draws a frame on a fixed cell grid, for surfaces whose text is proportional; `scale` shrinks or grows the drawing. */
export function svgOf(frame: Frame, columns: number, scale = 1): string {
  const texts: string[] = []
  frame.forEach((row, rowIndex) => {
    let cell = 0
    for (const span of row) {
      for (const char of span.text) {
        if (char !== ' ') {
          const x = +(cell * CELL_WIDTH).toFixed(2)
          const y = rowIndex * ROW_HEIGHT + FONT_SIZE
          texts.push(`<text x="${x}" y="${y}" fill="${fillOf(span.color)}">${escapeXml(char)}</text>`)
        }
        cell += cellsOf(char)
      }
    }
  })
  const width = +(columns * CELL_WIDTH).toFixed(2)
  const height = frame.length * ROW_HEIGHT
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${+(width * scale).toFixed(2)}" height="${+(height * scale).toFixed(2)}" viewBox="0 0 ${width} ${height}" ` +
    `font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" xml:space="preserve">${texts.join('')}</svg>`
  )
}

const HEAD_TOP = '.-----.'
const EYES = '[o   o]'
// The narrow robot's head top and eyes: NARROW_CELLS fewer.
const NARROW_HEAD_TOP = '.---.'
const NARROW_EYES = '[o o]'
// Flames sit in the head top between its corner dots; every step is 7 cells, the width of HEAD_TOP.
const HEAD_TOPS = ['.🔥 🔥.', '.🔥🔥-.', '.-🔥🔥.', '.🔥-🔥.']
// The same flames for the narrow head top, 5 cells each.
const NARROW_HEAD_TOPS = ['.🔥 .', '.-🔥.', '. 🔥.', '.🔥-.']
// A panicked face: the two eye characters swap each tick, keeping the block's 7 cells.
const PANIC_EYES = [['O', 'O'], ['>', '<']] as const
// Sparks beside the head top; a space leaves the spot dark so they pop.
const SPARKS = ['*', ' ', '.', "'"]

type Cell = { char: string; color: string }

const cellsOfFrameRow = (row: Span[]): Cell[] => row.flatMap(span => [...span.text].map(char => ({ char, color: span.color })))

function spansOfCells(cells: Cell[]): Span[] {
  const spans: Span[] = []
  for (const { char, color } of cells) {
    const last = spans[spans.length - 1]
    if (last && last.color === color) last.text += char
    else spans.push({ text: char, color })
  }
  return spans
}

/** A frame as rows of cells: a wide char takes two, the char then an empty continuation cell, so an index is a screen column. */
const gridOf = (frame: Frame): Cell[][] =>
  frame.map(row => row.flatMap(span => [...span.text].flatMap(char => (cellsOf(char) === 2 ? [{ char, color: span.color }, { char: '', color: span.color }] : [{ char, color: span.color }]))))

/** The screen column of the robot's eyes `[`, on the first row that has one. */
const eyesAtOf = (rows: Cell[][]): number | undefined => rows.map(cells => cells.findIndex(cell => cell.char === '[')).find(at => at >= 0)

// The columns the narrow robot drops, counted from the body start (two cells left of the eyes `[`).
const NARROW_DROPS = [4, 6]
/** Cells the narrow robot saves: one each side of the middle of its head, eyes, body and wheels. */
export const NARROW_CELLS = NARROW_DROPS.length

/**
 * The robot drawn two cells narrower: `.---.`, `[o o]`, `/|━|\`, `o o`. The same two columns go from every row, so
 * whatever stands beside the robot keeps its place against it. The eyes find the body, so mirrored acts work too.
 * A wide char caught in a dropped column turns into spaces. No eyes, no change.
 */
export function narrowed(frame: Frame): Frame {
  const rows = gridOf(frame)
  const eyesAt = eyesAtOf(rows)
  if (eyesAt === undefined) return frame
  const drops = NARROW_DROPS.map(drop => eyesAt - 2 + drop)
  return rows.map(cells => {
    for (const drop of drops) {
      const cell = cells[drop]
      if (!cell || cellsOf(cell.char) === 1) continue
      // Half of a wide char: blank both of its cells.
      const head = cell.char === '' ? drop - 1 : drop
      cells[head] = { char: ' ', color: DEFAULT_COLOR }
      cells[head + 1] = { char: ' ', color: DEFAULT_COLOR }
    }
    return spansOfCells(cells.filter((_, at) => !drops.includes(at)))
  })
}

/**
 * Heats the head: red, flames in the head top, sparks beside it and a panicked face, all moving with the tick.
 * `isNarrow` says the frame holds the narrow robot.
 */
export function heated(frame: Frame, isHot: boolean, tick: number, isNarrow = false): Frame {
  if (!isHot) return frame
  const orange = hexOf(ORANGE_INDEX)
  const red = hexOf(196)
  return frame.map((row, rowIndex) => {
    if (rowIndex > 1) return row
    const recoloured = row.map(span => (span.color === orange ? { ...span, color: red } : span))
    const cells = cellsOfFrameRow(recoloured)
    const text = cells.map(cell => cell.char).join('')
    if (rowIndex === 0) {
      const head = isNarrow ? NARROW_HEAD_TOP : HEAD_TOP
      const tops = isNarrow ? NARROW_HEAD_TOPS : HEAD_TOPS
      const at = text.indexOf(head)
      if (at < 0) return recoloured
      const top = tops[tick % tops.length] ?? head
      cells.splice(at, head.length, ...[...top].map(char => ({ char, color: red })))
      // Sparks only replace existing spaces, left and right of the head top.
      const sparks = [
        { index: at - 1, side: 0 },
        { index: at - 2, side: 1 },
        { index: at + top.length, side: 2 },
        { index: at + top.length + 1, side: 3 },
      ]
      for (const { index, side } of sparks) {
        const cell = cells[index]
        if (index < 0 || !cell || cell.char !== ' ') continue
        cells[index] = { char: SPARKS[(tick + side) % SPARKS.length] ?? ' ', color: hexOf(side % 2 === 0 ? 226 : 208) }
      }
      return spansOfCells(cells)
    }
    const eyes = isNarrow ? NARROW_EYES : EYES
    const at = text.indexOf(eyes)
    if (at < 0) return recoloured
    const [left, right] = PANIC_EYES[tick % PANIC_EYES.length] ?? PANIC_EYES[0]
    cells[at + 1] = { char: left, color: cells[at + 1]?.color ?? red }
    cells[at + eyes.length - 2] = { char: right, color: cells[at + eyes.length - 2]?.color ?? red }
    return spansOfCells(cells)
  })
}

// The robot packing itself into a box while the conversation compacts, one part at a time.
const BOX_WIDTH = 9
const BOX_COLOR = 180
/** Stages of packing, in order; the last one holds until the compaction ends. */
export const PACK_STAGES = 5
// One loop, a stage a step: pack in, hold the closed (shaking) box, unpack, again.
const PACK_LOOP = [0, 1, 2, 3, 4, 4, 4, 3, 2, 1]
/** The packing stage `steps` steps into a compaction; it loops as long as the compaction runs. */
export const packStage = (steps: number): number => PACK_LOOP[Math.max(0, steps) % PACK_LOOP.length] ?? 0
// Each stage: what is left of the robot (rows 0–3, '' for packed parts) and the box (rows 0–3, '' for nothing).
const PACKING: { robot: string[]; box: string[] }[] = [
  { robot: ['  .-----.', '  [o   o]', '  /|━━━|\\', '   o   o'], box: ['', '│       │', '│       │', '└───────┘'] },
  { robot: ['  .-----.', '  [o   o]', '  /|━━━|\\', ''], box: ['', '│       │', '│ o   o │', '└───────┘'] },
  { robot: ['  .-----.', '  [o   o]', '', ''], box: ['', '│       │', '│o|━━━|o│', '└───────┘'] },
  { robot: ['', '', '', ''], box: [' .-----. ', '│[^   ^]│', '│o|━━━|o│', '└───────┘'] },
  { robot: ['', '', '', ''], box: ['┌───────┐', '│ robot │', '│ ↑ ↑ ↑ │', '└───────┘'] },
]

// The same stages for the narrow robot, in a box NARROW_CELLS narrower.
const NARROW_PACKING: { robot: string[]; box: string[] }[] = [
  { robot: ['  .---.', '  [o o]', '  /|━|\\', '   o o'], box: ['', '│     │', '│     │', '└─────┘'] },
  { robot: ['  .---.', '  [o o]', '  /|━|\\', ''], box: ['', '│     │', '│ o o │', '└─────┘'] },
  { robot: ['  .---.', '  [o o]', '', ''], box: ['', '│     │', '│o|━|o│', '└─────┘'] },
  { robot: ['', '', '', ''], box: [' .---. ', '│[^ ^]│', '│o|━|o│', '└─────┘'] },
  { robot: ['', '', '', ''], box: ['┌─────┐', '│robot│', '│↑ ↑ ↑│', '└─────┘'] },
]

/**
 * The robot at `pos` packing itself into a box beside it: legs, then body, then its head hops in and the lid
 * closes; the closed box shakes with the tick. The box sits right of the robot, or left when it does not fit.
 * `isNarrow` packs the narrow robot into a narrower box.
 */
export function packing(pos: number, columns: number, stage: number, tick: number, isNarrow = false): Frame {
  const stages = isNarrow ? NARROW_PACKING : PACKING
  const { robot, box } = stages[Math.min(Math.max(stage, 0), stages.length - 1)] ?? { robot: [], box: [] }
  const boxWidth = BOX_WIDTH - (isNarrow ? NARROW_CELLS : 0)
  const right = pos + BODY_END - (isNarrow ? NARROW_CELLS : 0) + 2
  const boxAt = (right + boxWidth <= columns || pos < boxWidth ? right : pos - boxWidth) + (stage >= stages.length - 1 ? tick % 2 : 0)
  const orange = hexOf(ORANGE_INDEX)
  const cardboard = hexOf(BOX_COLOR)
  return [0, 1, 2, 3].map(row => {
    const cells: Cell[] = []
    const put = (at: number, text: string, color: string) => {
      ;[...text].forEach((char, i) => {
        if (char === ' ') return
        while (cells.length <= at + i) cells.push({ char: ' ', color: DEFAULT_COLOR })
        cells[at + i] = { char, color: /[│└┘┌─]/.test(char) || stage >= stages.length - 1 ? cardboard : orange }
      })
    }
    put(pos, robot[row] ?? '', orange)
    put(boxAt, box[row] ?? '', cardboard)
    return spansOfCells(cells)
  })
}
// The robot body ends this many cells after its position.
const BODY_END = 9

/** The colour that means "the surface's own text colour": Text leaves it unset, SVG draws DEFAULT_FILL. */
export const DEFAULT_COLOR = ''
/** Neutral grey for default-coloured text in SVG, readable on light and dark backgrounds. */
const DEFAULT_FILL = '#a8a8a8'
/** Claude Code's theme colour for slash commands; Text resolves the key, SVG draws COMMAND_FILL. */
export const COMMAND_COLOR = 'suggestion'
const COMMAND_FILL = '#b1b9f9'
const fillOf = (color: string): string => (color === COMMAND_COLOR ? COMMAND_FILL : color || DEFAULT_FILL)
/** First row of speech: the robot's eyes; each further line goes one row down. */
const SPEECH_ROW = 1
/** Empty cells between the robot and its speech. */
const SPEECH_GAP = 4

const textOfSpans = (spans: Span[]): string => spans.map(span => span.text).join('')

/**
 * Puts speech lines (each a list of coloured spans) beside the robot, one per row from its eyes down:
 * to its right if they fit in `columns`, else to its left, else nowhere.
 */
export function speech(frame: Frame, lines: Span[][], columns: number): Frame {
  const rows = lines.map((_, i) => frame[SPEECH_ROW + i])
  if (rows.some(row => !row)) return frame
  const texts = rows.map(row => textOfSpans(row ?? []))
  const longest = Math.max(...lines.map(line => cellsOf(textOfSpans(line))))
  // Anchored on the eyes row, which arms never pass, so moving arms never shift the speech.
  const eyes = texts[0] ?? ''
  const anchor = eyes.length - eyes.trimStart().length
  const end = Math.max(anchor + cellsOf(eyes.trimStart()), ...texts.map(cellsOf))
  const blank = (cells: number): Span => ({ text: ' '.repeat(Math.max(0, cells)), color: DEFAULT_COLOR })

  if (end + SPEECH_GAP + longest <= columns) {
    return frame.map((row, i) => {
      const line = lines[i - SPEECH_ROW]
      if (!line) return row
      return [...row, blank(end - cellsOf(texts[i - SPEECH_ROW] ?? '') + SPEECH_GAP), ...line]
    })
  }

  const lead = Math.min(anchor, ...texts.map(text => text.length - text.trimStart().length))
  const start = lead - SPEECH_GAP - longest
  if (start < 0) return frame
  return frame.map((row, i) => {
    const line = lines[i - SPEECH_ROW]
    if (!line) return row
    const after = lead - start - cellsOf(textOfSpans(line))
    return [blank(start), ...line, blank(after), ...spansOfCells(cellsOfFrameRow(row).slice(lead))]
  })
}

/** The first `count` characters of the lines, read across them in order, each line padded to its full width. */
export function typedSoFar(lines: Span[][], count: number): Span[][] {
  let left = count
  return lines.map(line => {
    const out: Span[] = []
    for (const span of line) {
      const chars = [...span.text]
      const shown = chars.slice(0, Math.max(0, left)).join('')
      left -= chars.length
      out.push({ ...span, text: shown + ' '.repeat(chars.length - [...shown].length) })
    }
    return out
  })
}

// Ticks per rise of the rocket: it climbs one row every three ticks.
const ROCKET_TICKS = 3
// Empty cells between the robot's raised arm and the celebration beside it.
const CHEER_GAP = 2

/**
 * The robot at `x` cheering a git act: a commit raises both arms and stamps a ✅, a push waves one arm and sends a
 * 🚀 up a row every three ticks. The words sit right of the robot, or left when they do not fit in `columns`.
 */
export function celebrating(x: number, columns: number, act: 'commit' | 'push', t: number): Frame {
  const orange = hexOf(ORANGE_INDEX)
  const isCommit = act === 'commit'
  const wave = t % 2 === 0
  const body = isCommit
    ? ['\\o.-----.o/', '  [^   ^]', '   |━━━|', '   o   o']
    : [wave ? '  .-----.\\o' : '  .-----.', '  [^   ^]', wave ? '   |━━━|' : '  /|━━━|\\', '   o   o']
  const mark = isCommit ? '✅' : '🚀'
  const word = isCommit ? 'committed!' : 'pushed!'
  // The mark's row: the ✅ bounces between the face row and the one above; the 🚀 climbs from row 3 to row 0.
  const markRow = isCommit ? 1 - (t % 2) : Math.max(0, 3 - Math.floor(Math.max(0, t) / ROCKET_TICKS))
  const width = cellsOf(mark) + 1 + cellsOf(word)
  const right = x + BODY_END + 1 + CHEER_GAP
  const at = right + width <= columns || x < width + CHEER_GAP ? right : x - CHEER_GAP - width
  return body.map((raw, row) => {
    const parts: { at: number; text: string; color: string }[] = [{ at: x, text: raw, color: orange }]
    if (row === markRow) parts.push({ at, text: mark, color: DEFAULT_COLOR })
    if (row === 1) parts.push({ at: at + cellsOf(mark) + 1, text: word, color: DEFAULT_COLOR })
    const spans: Span[] = []
    let cursor = 0
    for (const part of parts.sort((a, b) => a.at - b.at)) {
      if (part.at > cursor) spans.push({ text: ' '.repeat(part.at - cursor), color: DEFAULT_COLOR })
      spans.push({ text: part.text, color: part.color })
      cursor = part.at + cellsOf(part.text)
    }
    return spans
  })
}

// A friend is a small WALL-E robot, six cells wide.
const FRIEND_WIDTH = 6
// Empty cells between friends.
const FRIEND_GAP = 1
// Empty cells between the robot's drawing and its nearest friend.
const BACK_GAP = 4
const FRIEND_BODY_COLOR = hexOf(178)
const FRIEND_TREADS_COLOR = hexOf(244)
const FRIEND_EYES = { normal: '(o)(o)', blink: '(-)(-)', curious: '(O)(o)', wide: '(O)(O)' } as const
const FRIEND_NECK = '  ||  '
const FRIEND_BODY = '=[##]='
const FRIEND_TREADS = ['(oooo)', '(OOOO)'] as const

/** What the friends feel: `hot` when the context is on fire, `cheer` while the robot celebrates a git act. */
export type FriendMood = 'normal' | 'hot' | 'cheer'

type FriendPart = { up: number; text: string; color: string }

/** The parts of one friend, each `up` rows above the feet row. */
function friendParts(friend: Friend, tick: number, mood: FriendMood, isWalking: boolean): FriendPart[] {
  const isMoving = friend.leaving || friend.lag > 0
  const isRolling = isMoving || isWalking
  const treads = { up: 0, text: isRolling ? (FRIEND_TREADS[tick % 2] ?? FRIEND_TREADS[0]) : FRIEND_TREADS[0], color: FRIEND_TREADS_COLOR }
  const body = (up: number): FriendPart => ({ up, text: FRIEND_BODY, color: FRIEND_BODY_COLOR })
  const eyes = (up: number, text: string): FriendPart => ({ up, text, color: DEFAULT_COLOR })

  if (mood === 'cheer' && tick % 2 === 0) return [eyes(3, FRIEND_EYES.normal), body(2), { ...treads, up: 1 }]
  if (mood === 'hot') return [eyes(2, FRIEND_EYES.wide), body(1), treads]
  const isBlinking = (tick + friend.id * 5) % 16 === 0
  if (isRolling || mood === 'cheer') return [eyes(2, isBlinking ? FRIEND_EYES.blink : FRIEND_EYES.normal), body(1), treads]
  if ((tick + friend.id * 8) % 24 < 4) return [eyes(3, FRIEND_EYES.normal), { up: 2, text: FRIEND_NECK, color: FRIEND_BODY_COLOR }, body(1), treads]
  const isCurious = (tick + friend.id * 7) % 20 < 2
  return [eyes(2, isBlinking ? FRIEND_EYES.blink : isCurious ? FRIEND_EYES.curious : FRIEND_EYES.normal), body(1), treads]
}

/**
 * Adds one small WALL-E robot per friend (`friends` come from stepFriends) at the robot's back, and a `+extra` label (the subagents past the friends drawn)
 * after the last one only when more subagents run (`count`) than the most friends drawn. The back is the side of the
 * body the drawing reaches out the least (the fishing rod, the balloon, the cow are all in front); a tie, such as a
 * plain walk, falls back to `dir` (1 walks right, so the back is on the left). A friend sits at its slot plus its `lag`
 * cells further toward the back edge, and is drawn only when it fits whole inside `columns`. Friends only ever stand on
 * empty cells, so speech and arms are never overwritten. No friends, no change.
 */
export function withFriends(frame: Frame, x: number, dir: 1 | -1, columns: number, friends: readonly Friend[], count: number, tick: number, mood: FriendMood, isWalking: boolean, isNarrow = false): Frame {
  if (friends.length === 0 || frame.length < 4) return frame
  const rows = gridOf(frame)
  // Mirrored acts pad the body to the right of `x`, so find it by its eyes: the head's `[` sits two cells in.
  const eyesAt = eyesAtOf(rows)
  const bodyStart = eyesAt === undefined ? x : eyesAt - 2
  const bodyEnd = bodyStart + BODY_END - (isNarrow ? NARROW_CELLS : 0)
  const inks = rows.flatMap(cells => cells.flatMap((cell, at) => (cell.char === ' ' || cell.char === '' ? [] : [at])))
  const first = Math.min(bodyStart, ...inks)
  const last = Math.max(bodyEnd, ...inks)
  const reachLeft = bodyStart - first
  const reachRight = last - bodyEnd
  const isLeft = reachLeft === reachRight ? dir === 1 : reachLeft < reachRight
  const feet = rows.length - 1
  const isFree = (start: number, width: number, upTo: number[]): boolean =>
    start >= 0 && start + width <= columns && upTo.every(row => (rows[row] ?? []).slice(start, start + width).every(cell => cell.char === ' '))
  const put = (row: number, at: number, text: string, color: string) => {
    const cells = rows[row] ?? []
    while (cells.length < at + text.length) cells.push({ char: ' ', color: DEFAULT_COLOR })
    ;[...text].forEach((char, i) => {
      cells[at + i] = { char, color }
    })
  }
  const slotOf = (index: number, lag: number): number => (isLeft ? first - BACK_GAP - FRIEND_WIDTH - index * (FRIEND_WIDTH + FRIEND_GAP) - lag : last + 1 + BACK_GAP + index * (FRIEND_WIDTH + FRIEND_GAP) + lag)

  let isLastDrawn = false
  friends.forEach((friend, index) => {
    const start = slotOf(index, friend.lag)
    const parts = friendParts(friend, tick, mood, isWalking)
    const used = parts.map(part => feet - part.up)
    const isDrawn = used.every(row => row >= 0) && isFree(start, FRIEND_WIDTH, used)
    if (index === friends.length - 1) isLastDrawn = isDrawn
    if (!isDrawn) return
    for (const part of parts) put(feet - part.up, start, part.text, part.color)
  })

  const label = `+${count - MAX_FRIENDS}`
  if (isLastDrawn && count > MAX_FRIENDS) {
    const lastFriend = friends[friends.length - 1]
    const lastStart = slotOf(friends.length - 1, lastFriend?.lag ?? 0)
    const at = isLeft ? lastStart - FRIEND_GAP - label.length : lastStart + FRIEND_WIDTH + FRIEND_GAP
    if (isFree(at, label.length, [feet])) put(feet, at, label, DEFAULT_COLOR)
  }
  return rows.map(spansOfCells)
}
