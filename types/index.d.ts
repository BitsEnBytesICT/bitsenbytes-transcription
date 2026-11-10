export type DictationPhase = 'idle' | 'starting' | 'recording' | 'transcribing'

export type DictationModel = { id: string; name: string }

declare module 'claude-code' {
  interface PluginState {
    'openrouter-dictation': {
      phase: DictationPhase
      notice: string | null
      model: string
      language: string
      models: DictationModel[]
      hasKey: boolean
      isEditingKey: boolean
      // Label who said what ("Speaker 1: ...") on models that can.
      speakers: boolean
      // How many of the drawer's items show: 0 is folded, DRAWER_ITEMS open.
      drawer: number
    }
  }
}
