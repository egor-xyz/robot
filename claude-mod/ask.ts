/** Whether an answer ends on a question to the person: its last non-empty line ends with `?` (markdown marks after it allowed). */
export function isQuestion(answer: string): boolean {
  const last = answer.split('\n').map(line => line.trim()).filter(Boolean).at(-1) ?? ''
  return /\?[*_`)"'\]]*$/.test(last)
}
