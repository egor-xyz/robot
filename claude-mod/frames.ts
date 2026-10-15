import { MAX_FRIENDS } from './friends'
import type { Friend } from './friends'

/** One run of text in one colour; with `href`, a link. */
export type Span = { text: string; color: string; href?: string }

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
    cells += code >= 0x1f000 || [0x2615, 0x26bd, 0x2728, 0x2753, 0x2b50].includes(code) ? 2 : 1
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

/** Draws a frame on a fixed cell grid, for surfaces whose text is proportional. */
export function svgOf(frame: Frame, columns: number): string {
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
    `font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" xml:space="preserve">${texts.join('')}</svg>`
  )
}

const HEAD_TOP = '.-----.'
const EYES = '[o   o]'
// Flames sit in the head top between its corner dots; every step is 7 cells, the width of HEAD_TOP.
const HEAD_TOPS = ['.🔥 🔥.', '.🔥🔥-.', '.-🔥🔥.', '.🔥-🔥.']
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

/** Heats the head: red, flames in the head top, sparks beside it and a panicked face, all moving with the tick. */
export function heated(frame: Frame, isHot: boolean, tick: number): Frame {
  if (!isHot) return frame
  const orange = hexOf(ORANGE_INDEX)
  const red = hexOf(196)
  return frame.map((row, rowIndex) => {
    if (rowIndex > 1) return row
    const recoloured = row.map(span => (span.color === orange ? { ...span, color: red } : span))
    const cells = cellsOfFrameRow(recoloured)
    const text = cells.map(cell => cell.char).join('')
    if (rowIndex === 0) {
      const at = text.indexOf(HEAD_TOP)
      if (at < 0) return recoloured
      const top = HEAD_TOPS[tick % HEAD_TOPS.length] ?? HEAD_TOP
      cells.splice(at, HEAD_TOP.length, ...[...top].map(char => ({ char, color: red })))
      // Sparks only replace spaces, left and right of the head top; the row grows on the right to hold its sparks.
      // Counted in characters: an emoji is one cell entry but two UTF-16 units of `top.length`.
      const end = at + [...top].length
      while (cells.length < end + 2) cells.push({ char: ' ', color: DEFAULT_COLOR })
      const sparks = [
        { index: at - 1, side: 0 },
        { index: at - 2, side: 1 },
        { index: end, side: 2 },
        { index: end + 1, side: 3 },
      ]
      for (const { index, side } of sparks) {
        const cell = cells[index]
        if (index < 0 || !cell || cell.char !== ' ') continue
        cells[index] = { char: SPARKS[(tick + side) % SPARKS.length] ?? ' ', color: hexOf(side % 2 === 0 ? 226 : 208) }
      }
      return spansOfCells(cells)
    }
    const at = text.indexOf(EYES)
    if (at < 0) return recoloured
    const [left, right] = PANIC_EYES[tick % PANIC_EYES.length] ?? PANIC_EYES[0]
    cells[at + 1] = { char: left, color: cells[at + 1]?.color ?? red }
    cells[at + 5] = { char: right, color: cells[at + 5]?.color ?? red }
    return spansOfCells(cells)
  })
}

// Cold: the icy blue of the head, readable on light and dark; snow beside the head top.
const ICE = hexOf(32)
const SNOW = ['*', ' ', '·', ' ']

/** The index of the first cell of `text` in `cells`, or -1. */
const indexOfCells = (cells: Cell[], text: string): number => {
  const chars = [...text]
  return cells.findIndex((_, i) => chars.every((char, k) => cells[i + k]?.char === char))
}

/**
 * Chills the robot: the whole robot icy blue, 🧊 on each side of the head top and of the feet,
 * snow twinkling beside the head and the body, and chattering eyes, moving with the tick.
 * Places go by screen column, so a 2-cell emoji in a row does not shift them; each row stays
 * within the head top's columns plus 2 cells, as heated does. The eyes row keeps its spaces:
 * speech measures its bubble from that row.
 */
export function chilled(frame: Frame, isCold: boolean, tick: number): Frame {
  if (!isCold) return frame
  const top = cellsOfFrameRow(frame[0] ?? [])
  const headAt = indexOfCells(top, HEAD_TOP)
  const atCol = cellsOf(top.slice(0, headAt).map(cell => cell.char).join(''))
  const endCol = atCol + HEAD_TOP.length
  const cube = { char: '🧊', color: ICE }
  const snowOf = (k: number) => ({ char: SNOW[(tick + k) % SNOW.length] ?? ' ', color: ICE })
  return frame.map((row, rowIndex) => {
    const cells = cellsOfFrameRow(row.map(span => (span.color ? { ...span, color: ICE } : span)))
    if (headAt < 0) return spansOfCells(cells)
    if (rowIndex === 1) {
      const eyes = indexOfCells(cells, EYES)
      const eye = tick % 2 === 0 ? 'o' : '-'
      if (eyes >= 0) for (const i of [eyes + 1, eyes + 5]) cells[i] = { char: eye, color: ICE }
      return spansOfCells(cells)
    }
    // The cell that starts at screen column `col`, padding the row with spaces; -1 inside a 2-cell char.
    const indexAt = (col: number): number => {
      let at = 0
      for (let i = 0; ; i++) {
        if (i >= cells.length) cells.push({ char: ' ', color: DEFAULT_COLOR })
        if (at === col) return i
        at += cellsOf(cells[i]?.char ?? ' ')
        if (at > col) return -1
      }
    }
    const isSpaceAt = (col: number) => col >= 0 && cells[indexAt(col)]?.char === ' '
    const isCubeRow = rowIndex === 0 || rowIndex === 3
    // Right side first, so the left splice does not shift it.
    if (isCubeRow && isSpaceAt(endCol) && isSpaceAt(endCol + 1)) cells.splice(indexAt(endCol), 2, cube)
    else if (rowIndex === 2 && isSpaceAt(endCol)) cells[indexAt(endCol)] = snowOf(rowIndex)
    if (rowIndex !== 3 && isSpaceAt(atCol - 1)) cells[indexAt(atCol - 1)] = snowOf(rowIndex + 2)
    // One 2-cell cube replaces two spaces, so the robot does not move.
    if (isCubeRow && isSpaceAt(atCol - 3) && isSpaceAt(atCol - 2)) cells.splice(indexAt(atCol - 3), 2, cube)
    while (cells.at(-1)?.char === ' ') cells.pop()
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
/** First row of speech: the robot's eyes; each further line goes one row down. The bubble's top edge sits one row above. */
const SPEECH_ROW = 1
/** Empty cells between the robot and its speech bubble. */
const SPEECH_GAP = 2
/** Cells arms and sparks may reach past the eyes on either side; the bubble keeps clear of them so it never moves. */
const REACH = 2
/** Cells a bubble adds around its text: the tail, two borders and a space on each side. */
const BUBBLE_CELLS = 5

const textOfSpans = (spans: Span[]): string => spans.map(span => span.text).join('')
const blank = (cells: number): Span => ({ text: ' '.repeat(Math.max(0, cells)), color: DEFAULT_COLOR })

/** Wraps the lines in a comic speech bubble whose tail points at the robot, on the `tail` side. */
export function bubble(lines: Span[][], tail: 'left' | 'right'): Span[][] {
  const width = Math.max(0, ...lines.map(line => cellsOf(textOfSpans(line))))
  const rule = '─'.repeat(width + 2)
  const edge = (corners: string): Span[] => [{ text: tail === 'left' ? ` ${corners[0]}${rule}${corners[1]}` : `${corners[0]}${rule}${corners[1]} `, color: DEFAULT_COLOR }]
  const body = lines.map((line, i): Span[] => {
    const pad = blank(width - cellsOf(textOfSpans(line)))
    if (tail === 'left') return [{ text: i === 0 ? '<  ' : ' │ ', color: DEFAULT_COLOR }, ...line, pad, { text: ' │', color: DEFAULT_COLOR }]
    return [{ text: '│ ', color: DEFAULT_COLOR }, ...line, pad, { text: i === 0 ? '  >' : ' │ ', color: DEFAULT_COLOR }]
  })
  return [edge('╭╮'), ...body, edge('╰╯')]
}

/**
 * Puts speech lines (each a list of coloured spans) in a comic bubble beside the robot, one per row
 * from its eyes down: to its right if it fits in `columns`, else to its left, else nowhere.
 */
export function speech(frame: Frame, lines: Span[][], columns: number): Frame {
  const top = SPEECH_ROW - 1
  const rows = Array.from({ length: lines.length + 2 }, (_, i) => frame[top + i])
  if (rows.some(row => !row)) return frame
  const texts = rows.map(row => textOfSpans(row ?? []))
  const longest = Math.max(0, ...lines.map(line => cellsOf(textOfSpans(line)))) + BUBBLE_CELLS
  // Anchored on the eyes row, which arms never pass, so moving arms never shift the speech.
  const eyes = textOfSpans(frame[SPEECH_ROW] ?? [])
  const anchor = eyes.length - eyes.trimStart().length
  // Fixed to the eyes, not to the rows: arms and sparks move every tick, and the bubble must not.
  const end = anchor + cellsOf(eyes.trimStart()) + REACH

  if (end + SPEECH_GAP + longest <= columns) {
    const boxed = bubble(lines, 'left')
    return frame.map((row, i) => {
      const line = boxed[i - top]
      if (!line) return row
      // A row reaching past `end` (a wide arm) is cut there, so the bubble's left edge stays straight.
      const kept = cellsOfFrameRow(row).reduce<{ cells: Cell[]; width: number }>((acc, cell) => {
        const width = cellsOf(cell.char)
        return acc.width + width > end ? acc : { cells: [...acc.cells, cell], width: acc.width + width }
      }, { cells: [], width: 0 })
      return [...spansOfCells(kept.cells), blank(end - kept.width + SPEECH_GAP), ...line]
    })
  }

  const lead = anchor - REACH
  const start = lead - SPEECH_GAP - longest
  if (start < 0) return frame
  const boxed = bubble(lines, 'right')
  return frame.map((row, i) => {
    const line = boxed[i - top]
    if (!line) return row
    // Drop the first `lead` cells by width: a 2-cell char (the ice cube) must not shift the rest.
    const rest = cellsOfFrameRow(row).reduce<{ cells: Cell[]; width: number }>((acc, cell) => {
      const width = cellsOf(cell.char)
      // A cell cut by `lead` leaves a space for its remaining part.
      const next = acc.width >= lead ? cell : acc.width + width > lead ? { char: ' ', color: DEFAULT_COLOR } : undefined
      return { cells: next ? [...acc.cells, next] : acc.cells, width: acc.width + width }
    }, { cells: [], width: 0 })
    return [blank(start), ...line, blank(SPEECH_GAP), ...spansOfCells(rest.cells)]
  })
}

/** Cuts each row at `columns` cells, so a row too wide is clipped at the edge, not squeezed span by span. */
export function clipped(frame: Frame, columns: number): Frame {
  return frame.map(row => {
    if (cellsOf(textOfSpans(row)) <= columns) return row
    const kept = cellsOfFrameRow(row).reduce<{ cells: Cell[]; width: number }>((acc, cell) => {
      const width = cellsOf(cell.char)
      return acc.width + width > columns ? { ...acc, width: columns } : { cells: [...acc.cells, cell], width: acc.width + width }
    }, { cells: [], width: 0 })
    return spansOfCells(kept.cells)
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
 * empty cells, so speech and arms are never overwritten. No friends, no change. `layout` is the frame the side and
 * the slots are measured on (default `frame`): the frame without the fire sparks or snow, which change every tick and
 * would make the friends jump from side to side.
 */
export function withFriends(frame: Frame, x: number, dir: 1 | -1, columns: number, friends: readonly Friend[], count: number, tick: number, mood: FriendMood, isWalking: boolean, layout: Frame = frame): Frame {
  if (friends.length === 0 || frame.length < 4) return frame
  // A wide char takes two cells: the char, then an empty continuation cell, so a cell index is a screen column.
  const cellRowsOf = (f: Frame) => f.map(row => row.flatMap(span => [...span.text].flatMap(char => (cellsOf(char) === 2 ? [{ char, color: span.color }, { char: '', color: span.color }] : [{ char, color: span.color }]))))
  const rows = cellRowsOf(frame)
  const measured = layout === frame ? rows : cellRowsOf(layout)
  // Mirrored acts pad the body to the right of `x`, so find it by its eyes: the head's `[` sits two cells in.
  const eyesAt = measured.map(cells => cells.findIndex(cell => cell.char === '[')).find(at => at >= 0)
  const bodyStart = eyesAt === undefined ? x : eyesAt - 2
  const bodyEnd = bodyStart + BODY_END
  const inks = measured.flatMap(cells => cells.flatMap((cell, at) => (cell.char === ' ' || cell.char === '' ? [] : [at])))
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

// The compaction factory line: one robot or WALL-E at a time walks up to the station in the middle, packs itself into a box, the box rides a short belt to its end and drops out of sight, and only then the next one walks in.
/** Who rides the line: our robot or a WALL-E. */
export type FactoryUnit = 'robot' | 'walle'
type PackStep = { unit: string[]; box: string[] }
// Ticks a unit takes to walk in to the station.
const WALK_TICKS = 13
// Ticks a new open box takes to lower in, one row per tick.
const DROP_TICKS = 4
// Ticks per packing stage 1, 2 and 3.
const STAGE_TICKS = 3
// Ticks the closed box shakes at the station.
const CLOSED_TICKS = 5
// Ticks the belt runs to carry the closed box to its end; the next unit waits for it.
const SHIP_TICKS = 24
const SHIP_START = WALK_TICKS + DROP_TICKS + 3 * STAGE_TICKS + CLOSED_TICKS
/** Ticks per unit on the line. */
export const FACTORY_CYCLE = SHIP_START + SHIP_TICKS
// Cells per tick a walking unit moves.
const MOVE = 1
// Fewest cells per tick a shipped box moves; a longer belt ships faster, so the box is always gone in SHIP_TICKS.
const SHIP_SPEED = 1
// Cells per tick the belt marks move while the belt runs.
const BELT_SPEED = 2
// A `>` every this many belt cells, the rest `=`.
const BELT_MARK = 6
// Box widths in cells: the robot packs upright in a small box; a WALL-E lies side by side, wall to wall, in a wide one.
const ROBOT_BOX = 9
const WALLE_BOX = 15
// Ticks the closed box takes to hop from the station onto the belt.
const HOP_TICKS = 2
const BOX_COLOR = 180
const BELT_COLOR = FRIEND_TREADS_COLOR

// Each stage: what is left of the unit (rows 0-3, '' for packed parts) and the box (rows 0-3, '' for nothing).
const ROBOT_PACKING: PackStep[] = [
  { unit: ['  .-----.', '  [o   o]', '  /|━━━|\\', '   o   o'], box: ['', '│       │', '│       │', '└───────┘'] },
  { unit: ['  .-----.', '  [o   o]', '  /|━━━|\\', ''], box: ['', '│       │', '│ o   o │', '└───────┘'] },
  { unit: ['  .-----.', '  [o   o]', '', ''], box: ['', '│       │', '│o|━━━|o│', '└───────┘'] },
  { unit: ['', '', '', ''], box: [' .-----. ', '│[^   ^]│', '│o|━━━|o│', '└───────┘'] },
  { unit: ['', '', '', ''], box: ['┌───────┐', '│ robot │', '│ ↑ ↑ ↑ │', '└───────┘'] },
]
const WALLE_EYES = `  ${FRIEND_EYES.normal}`
const WALLE_BODY = `  ${FRIEND_BODY}`
const boxRow = (text: string) => `│${text.padEnd(WALLE_BOX - 2)}│`
const BOX_EMPTY = boxRow('')
const BOX_BOTTOM = `└${'─'.repeat(WALLE_BOX - 2)}┘`
// Cells of a WALL-E box row, wall included, up to the gap after the treads; the body and eyes sit right of it.
const TREADS_END = 7
const WALLE_LYING = boxRow(`${FRIEND_TREADS[0]} ${FRIEND_BODY}`)
// Declared after the friend constants it reads.
const WALLE_PACKING: PackStep[] = [
  { unit: ['', WALLE_EYES, WALLE_BODY, `  ${FRIEND_TREADS[0]}`], box: ['', BOX_EMPTY, BOX_EMPTY, BOX_BOTTOM] },
  { unit: ['', WALLE_EYES, WALLE_BODY, ''], box: ['', BOX_EMPTY, boxRow(FRIEND_TREADS[0]), BOX_BOTTOM] },
  { unit: ['', WALLE_EYES, '', ''], box: ['', BOX_EMPTY, WALLE_LYING, BOX_BOTTOM] },
  { unit: ['', '', '', ''], box: ['', boxRow(`   ${FRIEND_EYES.normal}`), WALLE_LYING, BOX_BOTTOM] },
  { unit: ['', '', '', ''], box: [`┌${'─'.repeat(WALLE_BOX - 2)}┐`, boxRow('    agent'), boxRow('    ↑ ↑ ↑'), BOX_BOTTOM] },
]

/** Unit `index` in a line started with `seed`: robots and WALL-Es take turns; the seed picks who goes first. */
export const unitOf = (index: number, seed = 0): FactoryUnit => ((((index + seed) % 2) + 2) % 2 === 0 ? 'robot' : 'walle')
const CLOSED_STAGE = 4
const packingOf = (unit: FactoryUnit): PackStep[] => (unit === 'robot' ? ROBOT_PACKING : WALLE_PACKING)

// A unit walking up the line: its stage-0 rows, with the feet on the alternate frame on odd ticks.
function walking(unit: FactoryUnit, tick: number): string[] {
  const rows = [...(packingOf(unit)[0]?.unit ?? [])]
  if (tick % 2 === 1) rows[3] = unit === 'robot' ? '   O   O' : `  ${FRIEND_TREADS[1]}`
  // A WALL-E stretches its neck up and down as it rolls, as it does at the robot's back.
  if (unit === 'walle' && Math.floor(tick / 4) % 2 === 1) [rows[0], rows[1]] = [WALLE_EYES, `  ${FRIEND_NECK}`]
  return rows
}

/**
 * The compaction factory line, `steps` ticks into a compaction, sized to `columns`: one robot or WALL-E walks up to the
 * station in the middle, a box drops in, the unit packs itself part by part, the closed box shakes, then rides a short belt to its end and drops out of sight; then
 * the next unit walks in. Always four rows; never draws a cell outside 0..columns-1. Pure: the same (columns, steps) gives
 * the same frame. `seed` picks whether a robot or a WALL-E goes first; then they take turns.
 */
export function factory(columns: number, steps: number, seed = 0): Frame {
  const rows: Cell[][] = [[], [], [], []]
  const put = (row: number, at: number, text: string, colorOf: (char: string, i: number) => string, end = columns) => {
    const cells = rows[row] ?? []
    ;[...text].forEach((char, i) => {
      const x = at + i
      if (char === ' ' || x < 0 || x >= Math.min(end, columns)) return
      while (cells.length <= x) cells.push({ char: ' ', color: DEFAULT_COLOR })
      cells[x] = { char, color: colorOf(char, i) }
    })
  }
  const orange = hexOf(ORANGE_INDEX)
  const cardboard = hexOf(BOX_COLOR)
  const unitColorOf = (unit: FactoryUnit, row: number): string =>
    unit === 'robot' ? orange : row <= 1 ? DEFAULT_COLOR : row === 2 ? FRIEND_BODY_COLOR : FRIEND_TREADS_COLOR
  // A packed WALL-E keeps its own colours: eyes on row 1, treads then body on row 2.
  const boxColorOf = (unit: FactoryUnit, stage: number, row: number) => (char: string, i: number) =>
    stage >= CLOSED_STAGE || /[│└┘┌┐─]/.test(char) ? cardboard
      : unit === 'robot' ? orange : row === 1 ? DEFAULT_COLOR : i < TREADS_END ? FRIEND_TREADS_COLOR : FRIEND_BODY_COLOR

  const tick = Math.max(0, steps)
  const cycle = Math.floor(tick / FACTORY_CYCLE)
  const phase = tick % FACTORY_CYCLE
  const isWalking = phase < WALK_TICKS
  const unit = unitOf(cycle, seed)
  // The box packs in the middle of the band, the unit to its left; the belt starts one cell right of the box.
  const boxWidth = unit === 'robot' ? ROBOT_BOX : WALLE_BOX
  const boxX = Math.max(BODY_END + 2, Math.floor((columns - boxWidth) / 2))
  const stationX = boxX - BODY_END - 2
  const beltX = boxX + boxWidth + 1
  // The belt runs half the way from the station to the right edge; the box drops out of sight at its end.
  const beltEnd = beltX + Math.floor((columns - beltX) / 2)
  const packPhase = phase - WALK_TICKS - DROP_TICKS
  const stage = packPhase < 0 ? 0 : Math.min(CLOSED_STAGE, 1 + Math.floor(packPhase / STAGE_TICKS))

  const shipped = Math.max(0, phase - SHIP_START + 1)
  const speed = Math.max(SHIP_SPEED, Math.ceil((beltEnd - beltX) / (SHIP_TICKS - HOP_TICKS)))
  const hop = beltX - boxX
  const shipShift = shipped <= HOP_TICKS ? Math.ceil((hop * shipped) / HOP_TICKS) : hop + speed * (shipped - HOP_TICKS)

  // The station box: lowers in from the top, holds the parts as they are packed, then hops onto the belt and rides to its end, where it drops out of sight.
  if (!isWalking) {
    const box = packingOf(unit)[stage]?.box ?? []
    const drop = phase - WALK_TICKS
    const shift = shipped > 0 ? shipShift : stage === CLOSED_STAGE ? tick % 2 : 0
    for (let row = 0; row < 4; row++) {
      const from = drop < DROP_TICKS ? row + 3 - drop : row
      if (from <= 3) put(row, boxX + shift, box[from] ?? '', boxColorOf(unit, stage, from), beltEnd)
    }
  }

  // The one unit on the line: walks the last steps to the station once the belt is clear, then stands there while it packs.
  const unitX = isWalking ? stationX - MOVE * (WALK_TICKS - 1 - phase) : stationX
  const art = isWalking ? walking(unit, tick) : packingOf(unit)[stage]?.unit ?? []
  art.forEach((text, row) => put(row, unitX, text, char => (char === '|' && unit === 'walle' ? FRIEND_BODY_COLOR : unitColorOf(unit, row))))

  // The belt shows only while a box rides it: it fills blank cells of the bottom row from right of the station to its end.
  if (shipped === 0) return rows.map(spansOfCells)
  const offset = BELT_SPEED * shipped
  const bottom = rows[3] ?? []
  for (let x = beltX; x < beltEnd; x++) {
    while (bottom.length <= x) bottom.push({ char: ' ', color: DEFAULT_COLOR })
    if (bottom[x]?.char === ' ') bottom[x] = { char: (((x - offset) % BELT_MARK) + BELT_MARK) % BELT_MARK === 0 ? '>' : '=', color: BELT_COLOR }
  }
  return rows.map(spansOfCells)
}
