export type Tick = number

declare module 'claude-code' {
  interface PluginState {
    robot: { tick: Tick; isHidden: boolean; contextPercent: number; isCompacting: boolean; celebration: { act: 'commit' | 'push'; at: Tick }; subagents: number; isAsked: boolean; status: { rank: number; spans: { text: string; color: string }[] }[]; effort: string; branch: string; waveAt: Tick; agentRows: { id: string; type: string; description: string; model: string; effort?: string; startedAt: number; tokens: number }[] }
  }
}
