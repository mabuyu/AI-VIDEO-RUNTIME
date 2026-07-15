import type { CompilerInputCandidate } from '../input'
import type { AudioDomainOutput, CompositionDomainOutput, DepthDomainOutput, EffectDomainOutput, ProducerResult, RuntimeDataV2CompilerAdapterInput } from '../runtimeDataV2'
import type { CompiledCameraTrack, CompiledTimeline, CompilerDiagnostic, SemanticProject, SemanticScene, SemanticSubtitle } from '../types'

export interface MvpScenarioCompilerOutput {
  readonly project: SemanticProject
  readonly scenes: readonly SemanticScene[]
  readonly subtitles: readonly SemanticSubtitle[]
  readonly timeline: CompiledTimeline
  readonly camera: readonly CompiledCameraTrack[]
  readonly effect: ProducerResult<EffectDomainOutput>
  readonly depth: ProducerResult<DepthDomainOutput>
  readonly composition: ProducerResult<CompositionDomainOutput>
  readonly audio: ProducerResult<AudioDomainOutput>
  readonly diagnostics: readonly CompilerDiagnostic[]
}

export interface MvpScenarioCompilerIssue {
  readonly source: 'mvp-scenario-compiler'
  readonly level: 'error'
  readonly code: 'INVALID_COMPILER_INPUT' | 'UNSUPPORTED_SCENARIO'
  readonly message: string
  readonly path?: string
}

export type MvpScenarioCompilerResult =
  | { readonly success: true; readonly output: MvpScenarioCompilerOutput }
  | { readonly success: false; readonly issues: readonly MvpScenarioCompilerIssue[] }

export interface MvpScenarioArtifactMetadata {
  readonly generationId: RuntimeDataV2CompilerAdapterInput['generationId']
  readonly artifact: RuntimeDataV2CompilerAdapterInput['artifact']
  readonly compatibility: RuntimeDataV2CompilerAdapterInput['compatibility']
  readonly generation: RuntimeDataV2CompilerAdapterInput['generation']
}

export function isCompilerInputCandidate(value: unknown): value is CompilerInputCandidate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  return ['projectIntent', 'contentIntent', 'styleIntent', 'sceneIntents', 'timelineIntent', 'audioIntent']
    .every((field) => input[field] !== undefined && input[field] !== null)
}
