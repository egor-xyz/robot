import type { Span } from './frames'
import { STATUS_RANK, effortColorOf, fitStatus, modelColorOf, modelNameOf, tokensOf } from './statusline'
import type { StatusGroup } from './statusline'

export { tokensOf } from './statusline'

/** One running subagent, as its spawn and its model requests report it. */
export type AgentRow = { id: string; type: string; description: string; model: string; effort?: string; startedAt: number; tokens: number }

/** Usage of one model request, as `turn.step` reports it. */
export type StepUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

const DIM = 'inactive'
/** At most this many agent lines; the rest count on one more line. */
export const MAX_AGENT_LINES = 3

// On a narrow screen the lowest rank goes first: the task stays longest.
const RANK = { type: 1, tokens: 2, model: 3, time: 4, task: 5 }

/** Time since `startedAt`: `0:06`, `12:40`. */
export function elapsedOf(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** All the tokens of one model request. */
export const stepTokensOf = (usage: StepUsage): number =>
  usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

/** An agent's model and effort as one status part; undefined when the row has neither (an agent found after a reload has no model yet). */
function modelGroupOf(row: AgentRow, rank: number): StatusGroup | undefined {
  const model = modelNameOf(row.model)
  if (!model && !row.effort) return undefined
  return {
    rank,
    spans: [...(model ? [{ text: model, color: modelColorOf(model) }] : []), ...(row.effort ? [{ text: `${model ? ' ' : ''}[${row.effort}]`, color: effortColorOf(row.effort) }] : [])],
  }
}

/** The task and type parts of an agent's line. */
export function viewedRowGroupsOf(row: AgentRow): StatusGroup[] {
  return [
    { rank: RANK.task, spans: [{ text: row.description || row.type, color: 'text' }] },
    { rank: RANK.type, spans: [{ text: row.type, color: DIM }] },
  ]
}

/** One agent's line, in parts: task, type, model and effort, tokens, time. */
export function agentGroupsOf(row: AgentRow, now: number): StatusGroup[] {
  const [task, type] = viewedRowGroupsOf(row)
  const model = modelGroupOf(row, RANK.model)
  return [
    task,
    type,
    ...(model ? [model] : []),
    { rank: RANK.tokens, spans: [{ text: `${tokensOf(row.tokens)} tok`, color: DIM }] },
    { rank: RANK.time, spans: [{ text: elapsedOf(row.startedAt, now), color: DIM }] },
  ]
}

/** The status line while `row`'s transcript is in view: its model and effort, tokens and time stand in for the session's model, cost and ctx. */
export function viewedStatusOf(groups: readonly StatusGroup[], row: AgentRow, now: number): StatusGroup[] {
  const model = modelGroupOf(row, STATUS_RANK.model)
  const kept = groups.filter(group => group.rank !== STATUS_RANK.cost && group.rank !== STATUS_RANK.ctx)
  const at = kept.findIndex(group => group.rank === STATUS_RANK.model)
  const swapped =
    at >= 0
      ? [...kept.slice(0, at), ...(model ? [model] : []), ...kept.slice(at + 1)]
      : model
        ? (() => {
            const account = kept.findIndex(group => group.rank === STATUS_RANK.account)
            return [...kept.slice(0, account + 1), model, ...kept.slice(account + 1)]
          })()
        : kept
  return [
    ...swapped,
    { rank: STATUS_RANK.cost, spans: [{ text: `${tokensOf(row.tokens)} tok`, color: DIM }] },
    { rank: STATUS_RANK.ctx, spans: [{ text: elapsedOf(row.startedAt, now), color: DIM }] },
  ]
}

/** What an agent definition file's frontmatter says about its model and effort. */
export type AgentDef = { model?: string; effort?: string }

/** Reads `model:` and `effort:` from the frontmatter of an agent definition; indented lines and the body are ignored. */
export function agentDefOf(text: string): AgentDef {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== '---') return {}
  const end = lines.indexOf('---', 1)
  if (end < 0) return {}
  const head = lines.slice(1, end)
  const valueOf = (key: string): string | undefined => {
    for (const line of head) {
      const value = new RegExp(`^${key}:\\s*(.+?)\\s*$`).exec(line)?.[1]
      if (value === undefined) continue
      const bare = /^(['"])(.*)\1$/.exec(value)?.[2] ?? value
      return bare || undefined
    }
    return undefined
  }
  const [model, effort] = [valueOf('model'), valueOf('effort')]
  return { ...(model ? { model } : {}), ...(effort ? { effort } : {}) }
}

/** The line under the agent lines when more agents run than they show. */
export const moreOf = (count: number): Span[] => (count > MAX_AGENT_LINES ? [{ text: `+${count - MAX_AGENT_LINES} more`, color: DIM }] : [])

/** The panel's lines: every agent as `mark` and its parts fitted to `columns`; none running, one dim line saying so. */
export function agentPaneLinesOf(rows: readonly AgentRow[], now: number, columns: number, mark: Span): Span[][] {
  if (rows.length === 0) return [[{ text: 'No subagents running.', color: DIM }]]
  return rows.map(row => [mark, ...fitStatus(agentGroupsOf(row, now), columns - mark.text.length)])
}
