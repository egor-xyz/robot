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
    const at = text.indexOf(EYES)
    if (at < 0) return recoloured
    const [left, right] = PANIC_EYES[tick % PANIC_EYES.length] ?? PANIC_EYES[0]
    cells[at + 1] = { char: left, color: cells[at + 1]?.color ?? red }
    cells[at + 5] = { char: right, color: cells[at + 5]?.color ?? red }
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

/**
 * The robot at `pos` packing itself into a box beside it: legs, then body, then its head hops in and the lid
 * closes; the closed box shakes with the tick. The box sits right of the robot, or left when it does not fit.
 */
export function packing(pos: number, columns: number, stage: number, tick: number): Frame {
  const { robot, box } = PACKING[Math.min(Math.max(stage, 0), PACKING.length - 1)] ?? { robot: [], box: [] }
  const right = pos + BODY_END + 2
  const boxAt = (right + BOX_WIDTH <= columns || pos < BOX_WIDTH ? right : pos - BOX_WIDTH) + (stage >= PACKING.length - 1 ? tick % 2 : 0)
  const orange = hexOf(ORANGE_INDEX)
  const cardboard = hexOf(BOX_COLOR)
  return [0, 1, 2, 3].map(row => {
    const cells: Cell[] = []
    const put = (at: number, text: string, color: string) => {
      ;[...text].forEach((char, i) => {
        if (char === ' ') return
        while (cells.length <= at + i) cells.push({ char: ' ', color: DEFAULT_COLOR })
        cells[at + i] = { char, color: /[│└┘┌─]/.test(char) || stage >= PACKING.length - 1 ? cardboard : orange }
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

// A friend is a three-cell, two-row mini robot; its eyes blink with the tick.
const FRIEND_WIDTH = 3
// Most friends drawn at once; the label still counts them all.
const MAX_FRIENDS = 3
// Empty cells between friends, and between the robot and its nearest friend.
const FRIEND_GAP = 1
const FRIEND_COLOR = 81

/**
 * Adds one small robot friend per running subagent (at most three) beside the robot at `x`, with a `×count` label
 * above them: on its left, or on its right when the left has no room, or nowhere when neither fits `columns`.
 * They only ever stand on empty cells, so speech and arms are never overwritten. No friends, no change.
 */
export function withFriends(frame: Frame, x: number, columns: number, count: number, tick: number): Frame {
  if (count < 1) return frame
  const friends = Math.min(count, MAX_FRIENDS)
  const label = `×${count}`
  const width = Math.max(friends * (FRIEND_WIDTH + FRIEND_GAP) - FRIEND_GAP, cellsOf(label))
  const rows = frame.map(cellsOfFrameRow)
  const isFree = (start: number): boolean =>
    start >= 0 && start + width <= columns && [1, 2, 3].every(row => (rows[row] ?? []).slice(start, start + width).every(cell => cell.char === ' '))
  const left = x - FRIEND_GAP - width
  const right = x + BODY_END + 1 + FRIEND_GAP
  const start = [left, right].find(isFree)
  if (start === undefined || frame.length < 4) return frame

  const color = hexOf(FRIEND_COLOR)
  const put = (row: number, at: number, text: string, textColor: string) => {
    const cells = rows[row] ?? []
    while (cells.length < at + [...text].length) cells.push({ char: ' ', color: DEFAULT_COLOR })
    ;[...text].forEach((char, i) => {
      cells[at + i] = { char, color: textColor }
    })
  }
  put(1, start, label, DEFAULT_COLOR)
  for (let i = 0; i < friends; i++) {
    const at = start + i * (FRIEND_WIDTH + FRIEND_GAP)
    const isBlinking = (tick + 3 * i) % 8 === 0
    put(2, at, isBlinking ? '[-]' : '[•]', color)
    put(3, at, '/ \\', color)
  }
  return rows.map(spansOfCells)
}

/**
 * The robot at `x` tapping its foot while it waits for you: it stands still, its eyes look down-right, one hand is on
 * its hip, and the foot lifts every two ticks.
 */
export function tapping(x: number, columns: number, tick: number): Frame {
  const orange = hexOf(ORANGE_INDEX)
  const foot = Math.floor(Math.max(0, tick) / 2) % 2 === 0 ? '   o   o' : '   o  _o'
  const body = ['  .-----.', '  [  ◕ ◕]', '  <|━━━|\\', foot]
  return body.map(raw => {
    const text = x + cellsOf(raw) > columns ? raw.slice(0, Math.max(0, columns - x)) : raw
    return [
      { text: ' '.repeat(x), color: DEFAULT_COLOR },
      { text, color: orange },
    ]
  })
}
