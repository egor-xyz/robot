export type Tick = number

declare module 'claude-code' {
  interface PluginState {
    robot: { tick: Tick; isHidden: boolean; contextPercent: number; isCompacting: boolean; celebration: { act: 'commit' | 'push'; at: Tick } }
  }
}
