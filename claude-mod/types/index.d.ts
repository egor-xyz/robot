export type Tick = number

declare module 'claude-code' {
  interface PluginState {
    robot: { tick: Tick; isHidden: boolean; contextPercent: number; isCompacting: boolean; celebration: { act: 'commit' | 'push'; at: Tick }; subagents: number; isAsked: boolean; status: { rank: number; spans: { text: string; color: string }[] }[]; effort: string; branch: string; waveAt: Tick; agentRows: { id: string; type: string; description: string; model: string; effort?: string; startedAt: number; tokens: number; step?: string }[]; changes: { path: string; added: number; removed: number; status: 'M' | 'A' | 'D'; group: 'local' | 'pr' }[]; changesQuery: string; changesPreview: { path: string; group: 'local' | 'pr'; root: string; diff: string }; changesCursor: string; pr: { number: number; url: string; baseRef: string; id: string; isConflict: boolean; failed: string[]; passed: number; running: number; isUnknown: boolean; threads: number; isAutoMerge: boolean }; changesPr: { number: number; base: string; url: string; files: number; added: number; removed: number }; cacheAt: number; cacheEndAt: number; cachePrompt: number; agentStepAt: number; cacheTtl: string; coldTokens: number }
  }
}
