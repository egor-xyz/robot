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
