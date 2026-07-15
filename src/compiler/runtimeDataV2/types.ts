import type {
  CompiledCameraTrack,
  CompiledTimeline,
  CompilerDiagnostic,
  SemanticProject,
  SemanticScene,
  SemanticSubtitle,
} from '../types'
import type {
  RuntimeAudioTrack,
  RuntimeCompositionTrack,
  RuntimeDataV2,
  RuntimeDepthTrack,
  RuntimeEffectTrack,
} from '../../runtimeData/types'
import type { CompilerDomainOutputBundle } from '../scenarioCompiler'

export type CompilerProducerDomain = 'effect' | 'depth' | 'composition' | 'audio'

export interface CompilerProducerIssue {
  readonly source: CompilerProducerDomain
  readonly level: 'error' | 'warning' | 'info'
  readonly code: string
  readonly message: string
  readonly path?: string
  readonly expected?: unknown
  readonly actual?: unknown
  readonly suggestion?: string
}

export type ProducerResult<T> =
  | { readonly success: true; readonly value: T; readonly issues: readonly CompilerProducerIssue[] }
  | { readonly success: false; readonly issues: readonly CompilerProducerIssue[] }

export interface DomainOutput<TTrack> { readonly tracks: readonly TTrack[] }
export type EffectDomainOutput = DomainOutput<RuntimeEffectTrack>
export type DepthDomainOutput = DomainOutput<RuntimeDepthTrack>
export type CompositionDomainOutput = DomainOutput<RuntimeCompositionTrack>
export interface AudioDomainOutput extends DomainOutput<RuntimeAudioTrack> {
  readonly duration: number
}

export interface CompilerArtifactIdentity {
  readonly id: string
  readonly revision: string
  readonly createdAt: string
}

export interface CompilerArtifactCompatibility {
  readonly schemaVersion: string | number
  readonly runtimeSchemaVersion: string | number
}

export interface CompilerGenerationMetadata {
  readonly compilerVersion: string
  readonly promptContractVersion: string | number
  readonly generatedAt: string
}

export interface CompilerArtifactDiagnostic {
  readonly level: 'warning' | 'info'
  readonly code: string
  readonly message: string
  readonly path?: string
  readonly suggestion?: string
}

export interface CompilerArtifactOutput {
  readonly artifact: CompilerArtifactIdentity
  readonly compatibility: CompilerArtifactCompatibility
  readonly generation: CompilerGenerationMetadata
  readonly runtimeData: RuntimeDataV2
  readonly diagnostics: readonly CompilerArtifactDiagnostic[]
}

export interface RuntimeDataV2CompilerAdapterInput {
  readonly generationId: string
  readonly project: SemanticProject
  readonly scenes: readonly SemanticScene[]
  readonly subtitles: readonly SemanticSubtitle[]
  readonly timeline: CompiledTimeline
  readonly camera: readonly CompiledCameraTrack[]
  readonly effect: ProducerResult<EffectDomainOutput>
  readonly depth: ProducerResult<DepthDomainOutput>
  readonly composition: ProducerResult<CompositionDomainOutput>
  readonly audio: ProducerResult<AudioDomainOutput>
  readonly artifact: CompilerArtifactIdentity
  readonly compatibility: CompilerArtifactCompatibility
  readonly generation: CompilerGenerationMetadata
  readonly diagnostics: readonly CompilerDiagnostic[]
}

export interface ScenarioCompilerAdapterHandoffInput {
  readonly generationId: string
  readonly bundle: CompilerDomainOutputBundle
  readonly artifact: CompilerArtifactIdentity
  readonly compatibility: CompilerArtifactCompatibility
  readonly generation: CompilerGenerationMetadata
  readonly diagnostics: readonly CompilerDiagnostic[]
}

export interface CompilerAdapterIssue {
  readonly source: 'compiler-adapter' | CompilerProducerDomain
  readonly level: 'error'
  readonly code: string
  readonly message: string
  readonly path?: string
  readonly expected?: unknown
  readonly actual?: unknown
  readonly suggestion?: string
}

export type CompilerAdapterResult =
  | { readonly success: true; readonly output: CompilerArtifactOutput }
  | { readonly success: false; readonly issues: readonly CompilerAdapterIssue[] }
