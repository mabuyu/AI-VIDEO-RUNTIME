export const SUPPORTED_PROMPT_CONTRACT_VERSION = '1' as const

export interface PromptDurationIntent {
  readonly value: number
  readonly unit: 'seconds' | 'minutes'
  readonly flexibility: 'exact' | 'approximate'
}

export interface PromptProjectIntent {
  readonly title: string
  readonly purpose: string
  readonly targetDuration: PromptDurationIntent
  readonly audience: string
}

export interface PromptContentIntent {
  readonly topic: string
  readonly message: string
  readonly keyPoints: readonly string[]
}

export interface PromptStyleIntent {
  readonly visualStyle: string
  readonly tone: string
  readonly pace: string
  readonly atmosphere: string
}

export interface PromptTimelineIntent {
  readonly pacing: string
  readonly structure: string
  readonly emphasis: readonly string[]
}

export interface PromptSceneIntent {
  readonly id: string
  readonly purpose: string
  readonly message: string
  readonly durationIntent: PromptDurationIntent
  readonly transitionIntent: string
}

export interface PromptAudioIntent {
  readonly intent: string
  readonly mood: string
  readonly voice: string
  readonly silencePreference: string
}

export interface PromptSemanticIntent {
  readonly project: PromptProjectIntent
  readonly content: PromptContentIntent
  readonly style: PromptStyleIntent
  readonly timeline: PromptTimelineIntent
  readonly scenes: readonly PromptSceneIntent[]
  readonly audio: PromptAudioIntent
}

export interface PromptProductionInput {
  readonly promptContractVersion: string | number
  readonly intent: PromptSemanticIntent
}

export interface CompilerInputCandidate {
  readonly projectIntent: PromptProjectIntent
  readonly contentIntent: PromptContentIntent
  readonly styleIntent: PromptStyleIntent
  readonly sceneIntents: readonly PromptSceneIntent[]
  readonly timelineIntent: PromptTimelineIntent
  readonly audioIntent: PromptAudioIntent
}

export interface PromptCompilerInputIssue {
  readonly code:
    | 'INVALID_INPUT'
    | 'UNSUPPORTED_PROMPT_CONTRACT_VERSION'
    | 'MISSING_REQUIRED_FIELD'
    | 'INVALID_FIELD'
    | 'INCOMPLETE_INTENT'
  readonly message: string
  readonly path: string
}

export type PromptCompilerInputAdapterResult =
  | { readonly success: true; readonly input: CompilerInputCandidate }
  | { readonly success: false; readonly issues: readonly PromptCompilerInputIssue[] }
