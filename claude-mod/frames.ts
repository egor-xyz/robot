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
          texts.push(`<text x="${x}" y="${y}" fill="${span.color || DEFAULT_FILL}">${escapeXml(char)}</text>`)
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

/** The colour that means "the surface's own text colour": Text leaves it unset, SVG draws DEFAULT_FILL. */
export const DEFAULT_COLOR = ''
/** Neutral grey for default-coloured text in SVG, readable on light and dark backgrounds. */
const DEFAULT_FILL = '#a8a8a8'
/** First row of speech: the robot's eyes; each further line goes one row down. */
const SPEECH_ROW = 1
/** Empty cells between the robot and its speech. */
const SPEECH_GAP = 4

/**
 * Puts speech lines beside the robot, one per row from its eyes down, in the default text colour:
 * to its right if they fit in `columns`, else to its left, else nowhere.
 */
export function speech(frame: Frame, lines: string[], columns: number): Frame {
  const rows = lines.map((_, i) => frame[SPEECH_ROW + i])
  if (rows.some(row => !row)) return frame
  const texts = rows.map(row => (row ?? []).map(span => span.text).join(''))
  const longest = Math.max(...lines.map(cellsOf))
  // Anchored on the eyes row, which arms never pass, so moving arms never shift the speech.
  const eyes = texts[0] ?? ''
  const anchor = eyes.length - eyes.trimStart().length
  const end = Math.max(anchor + cellsOf(eyes.trimStart()), ...texts.map(cellsOf))
  const say = (i: number): Span => ({ text: lines[i - SPEECH_ROW] ?? '', color: DEFAULT_COLOR })

  if (end + SPEECH_GAP + longest <= columns) {
    return frame.map((row, i) => {
      const line = i - SPEECH_ROW
      if (line < 0 || line >= lines.length) return row
      const pad = end - cellsOf(texts[line] ?? '') + SPEECH_GAP
      return [...row, { text: ' '.repeat(pad), color: DEFAULT_COLOR }, say(i)]
    })
  }

  const lead = Math.min(anchor, ...texts.map(text => text.length - text.trimStart().length))
  const start = lead - SPEECH_GAP - longest
  if (start < 0) return frame
  return frame.map((row, i) => {
    const line = i - SPEECH_ROW
    if (line < 0 || line >= lines.length) return row
    const spoken = say(i)
    const after = ' '.repeat(lead - start - cellsOf(spoken.text))
    return [{ text: ' '.repeat(start), color: DEFAULT_COLOR }, spoken, { text: after, color: DEFAULT_COLOR }, ...spansOfCells(cellsOfFrameRow(row).slice(lead))]
  })
}
