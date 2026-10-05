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
          texts.push(`<text x="${x}" y="${y}" fill="${span.color}">${escapeXml(char)}</text>`)
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
const FLAMES = '(/\\)/\\('
const FLAME_COLORS = [208, 226, 196].map(hexOf)

/** Heats the head: turns its orange red and swaps the head top for flames of the same width. */
export function heated(frame: Frame, isHot: boolean): Frame {
  if (!isHot) return frame
  const orange = hexOf(ORANGE_INDEX)
  const red = hexOf(196)
  return frame.map((row, rowIndex) => {
    if (rowIndex > 1) return row
    const recoloured = row.map(span => (span.color === orange ? { ...span, color: red } : span))
    if (rowIndex !== 0) return recoloured
    const cells = recoloured.flatMap(span => [...span.text].map(char => ({ char, color: span.color })))
    const at = cells.map(cell => cell.char).join('').indexOf(HEAD_TOP)
    if (at < 0) return recoloured
    ;[...FLAMES].forEach((char, i) => {
      cells[at + i] = { char, color: FLAME_COLORS[i % FLAME_COLORS.length] ?? red }
    })
    const spans: Span[] = []
    for (const { char, color } of cells) {
      const last = spans[spans.length - 1]
      if (last && last.color === color) last.text += char
      else spans.push({ text: char, color })
    }
    return spans
  })
}
