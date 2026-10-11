import type { Span } from './frames'
import { effortColorOf, modelColorOf, modelNameOf } from './statusline'
import type { StatusGroup } from './statusline'

/** One running subagent, as its spawn and its model requests report it. */
export type AgentRow = { id: string; type: string; description: string; model: string; effort?: string; startedAt: number; tokens: number }

/** Usage of one model request, as `turn.step` reports it. */
export type StepUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

const DIM = 'inactive'
/** At most this many agent lines; the rest count on one more line. */
export const MAX_AGENT_LINES = 3

// On a narrow screen the lowest rank goes first: the task stays longest.
const RANK = { type: 1, tokens: 2, model: 3, time: 4, task: 5 }

/** Tokens, short: `850`, `16k`, `1.2M`. */
export function tokensOf(tokens: number): string {
  if (tokens < 1000) return String(Math.max(0, Math.round(tokens)))
  if (tokens < 1_000_000) return `${Math.round(tokens / 1000)}k`
  return `${(tokens / 1_000_000).toFixed(1)}M`
}

/** Time since `startedAt`: `0:06`, `12:40`. */
export function elapsedOf(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** All the tokens of one model request. */
export const stepTokensOf = (usage: StepUsage): number =>
  usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

/** One agent's line, in parts: task, type, model and effort, tokens, time. */
export function agentGroupsOf(row: AgentRow, now: number): StatusGroup[] {
  const model = modelNameOf(row.model)
  return [
    { rank: RANK.task, spans: [{ text: row.description || row.type, color: 'text' }] },
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
