import type { Span } from './frames'
import { effortColorOf, modelColorOf, modelNameOf, tokensOf } from './statusline'
import type { StatusGroup } from './statusline'

export { tokensOf } from './statusline'

/** One running subagent, as its spawn, its model requests and its tool calls report it. */
export type AgentRow = { id: string; type: string; description: string; model: string; effort?: string; startedAt: number; tokens: number; step?: string }

/** Usage of one model request, as `turn.step` reports it. */
export type StepUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

const DIM = 'inactive'
/** At most this many agent lines; the rest count on one more line. */
export const MAX_AGENT_LINES = 3

// On a narrow screen the lowest rank goes first: the task stays longest.
const RANK = { type: 1, tokens: 2, step: 3, model: 4, time: 5, task: 6 }
/** The last tool's part is cut to this many characters. */
const STEP_MAX = 32

/** Time since `startedAt`: `0:06`, `12:40`. */
export function elapsedOf(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** All the tokens of one model request. */
export const stepTokensOf = (usage: StepUsage): number =>
  usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

/** What a tool call works on, short: a file's name, a command's first line, a pattern, a URL. */
function targetOf(input: Record<string, unknown>): string {
  for (const key of ['file_path', 'notebook_path', 'command', 'pattern', 'url', 'query', 'description']) {
    const value = input[key]
    if (typeof value !== 'string' || !value.trim()) continue
    const text = value.trim().split('\n')[0] ?? ''
    return key.endsWith('_path') ? (text.split('/').filter(Boolean).at(-1) ?? text) : text
  }
  return ''
}

/** The last tool an agent called, as its line shows it: `Read agents.ts`, `Bash git status`. */
export function stepOf(tool: string, input: Record<string, unknown>): string {
  // `mcp__server__tool` reads as its tool; `cd somewhere && make` as the command after the `cd`.
  const name = tool.startsWith('mcp__') ? (tool.split('__').at(-1) ?? tool) : tool
  const target = targetOf(input).replace(/^cd\s+\S+\s*&&\s*/, '')
  const text = target ? `${name} ${target}` : name
  return text.length > STEP_MAX ? `${text.slice(0, STEP_MAX - 1)}…` : text
}

/** One agent's line, in parts: task, last tool, type, model and effort, tokens, time. */
export function agentGroupsOf(row: AgentRow, now: number): StatusGroup[] {
  const model = modelNameOf(row.model)
  return [
    { rank: RANK.task, spans: [{ text: row.description || row.type, color: 'text' }] },
    ...(row.step ? [{ rank: RANK.step, spans: [{ text: row.step, color: DIM }] }] : []),
    { rank: RANK.type, spans: [{ text: row.type, color: DIM }] },
    // An agent found after a reload has no model until its next step: no empty part for it.
    ...(model || row.effort
      ? [{
          rank: RANK.model,
          spans: [...(model ? [{ text: model, color: modelColorOf(model) }] : []), ...(row.effort ? [{ text: `${model ? ' ' : ''}[${row.effort}]`, color: effortColorOf(row.effort) }] : [])],
        }]
      : []),
    { rank: RANK.tokens, spans: [{ text: `${tokensOf(row.tokens)} tok`, color: DIM }] },
    { rank: RANK.time, spans: [{ text: elapsedOf(row.startedAt, now), color: DIM }] },
  ]
}

/** The line under the agent lines when more agents run than they show. */
export const moreOf = (count: number): Span[] => (count > MAX_AGENT_LINES ? [{ text: `+${count - MAX_AGENT_LINES} more`, color: DIM }] : [])
