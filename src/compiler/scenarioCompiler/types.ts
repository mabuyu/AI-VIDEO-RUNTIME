import type { CompilerInputCandidate } from '../input'
import type { SelectedScenarioTemplate } from '../scenarioTemplateSelector'
import type {
  CompiledCameraTrack,
  CompiledTimeline,
  SemanticProject,
  SemanticScene,
  SemanticSubtitle,
} from '../types'

export interface ScenarioCompilerPlanningContext {
  readonly generationId: string
  readonly compilerVersion: string | number
  readonly promptContractVersion: string | number
  readonly scenarioTemplateVersion: string | number
}

export interface ScenarioCompilerInput {
  readonly selectedScenarioTemplate: SelectedScenarioTemplate
  readonly compilerInputCandidate: CompilerInputCandidate
  readonly planningContext: ScenarioCompilerPlanningContext
}

export type ScenarioCompilerDomain =
  | 'scene'
  | 'timeline'
  | 'camera'
  | 'effect'
  | 'depth'
  | 'composition'
  | 'audio'

export interface DomainProducerIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
}

export type ProducerResult<TOutput> =
  | { readonly success: true; readonly generationId: string; readonly output: TOutput }
  | {
      readonly success: false
      readonly issues: readonly DomainProducerIssue[]
      readonly generationId?: string
    }

export interface SceneDomainOutput {
  readonly project: SemanticProject
  readonly scenes: readonly SemanticScene[]
  readonly subtitles: readonly SemanticSubtitle[]
}

export interface TimelineDomainOutput {
  readonly timeline: CompiledTimeline
}

export interface CameraDomainOutput {
  readonly tracks: readonly CompiledCameraTrack[]
}

export interface EffectDomainTrack {
  readonly id: string
  readonly start: number
  readonly duration: number
  readonly effect: string
  readonly parameters: Readonly<Record<string, unknown>>
}

export interface EffectDomainOutput {
  readonly tracks: readonly EffectDomainTrack[]
}

export interface DepthDomainTrack {
  readonly id: string
  readonly start: number
  readonly duration: number
  readonly depth: string
  readonly parameters: Readonly<Record<string, unknown>>
}

export interface DepthDomainOutput {
  readonly tracks: readonly DepthDomainTrack[]
}

export interface CompositionDomainTrack {
  readonly id: string
  readonly start: number
  readonly duration: number
  readonly composition: string
  readonly parameters: Readonly<Record<string, unknown>>
}

export interface CompositionDomainOutput {
  readonly tracks: readonly CompositionDomainTrack[]
}

export interface GeneratedAudioDomainSegment {
  readonly start: number
  readonly duration: number
  readonly audioRef: string
}

export interface SilenceAudioDomainSegment {
  readonly start: number
  readonly duration: number
}

export interface GeneratedAudioDomainTrack {
  readonly id: string
  readonly type: 'generated-audio'
  readonly start: number
  readonly duration: number
  readonly volume: number
  readonly segments: readonly GeneratedAudioDomainSegment[]
}

export interface SilenceAudioDomainTrack {
  readonly id: string
  readonly type: 'silence'
  readonly start: number
  readonly duration: number
  readonly volume: 0
  readonly segments: readonly SilenceAudioDomainSegment[]
}

export type AudioDomainTrack = GeneratedAudioDomainTrack | SilenceAudioDomainTrack

export interface AudioDomainOutput {
  readonly duration: number
  readonly tracks: readonly AudioDomainTrack[]
}

interface ProducerInputBase {
  readonly selectedScenarioTemplate: SelectedScenarioTemplate
  readonly compilerInputCandidate: CompilerInputCandidate
  readonly planningContext: ScenarioCompilerPlanningContext
}

export type SceneProducerInput = ProducerInputBase

export interface TimelineProducerInput extends ProducerInputBase {
  readonly scene: SceneDomainOutput
}

export interface CameraProducerInput extends ProducerInputBase {
  readonly scene: SceneDomainOutput
  readonly timeline: TimelineDomainOutput
}

export interface EffectProducerInput extends ProducerInputBase {
  readonly scene: SceneDomainOutput
  readonly timeline: TimelineDomainOutput
}

export interface CompositionProducerInput extends ProducerInputBase {
  readonly scene: SceneDomainOutput
  readonly timeline: TimelineDomainOutput
  readonly camera: CameraDomainOutput
}

export interface DepthProducerInput extends ProducerInputBase {
  readonly scene: SceneDomainOutput
  readonly timeline: TimelineDomainOutput
  readonly camera: CameraDomainOutput
  readonly composition: CompositionDomainOutput
}

export interface AudioProducerInput extends ProducerInputBase {
  readonly scene: SceneDomainOutput
  readonly timeline: TimelineDomainOutput
}

export interface DomainProducer<TInput, TOutput> {
  produce(input: Readonly<TInput>): ProducerResult<TOutput>
}

export interface ScenarioCompilerProducerPorts {
  readonly scene: DomainProducer<SceneProducerInput, SceneDomainOutput>
  readonly timeline: DomainProducer<TimelineProducerInput, TimelineDomainOutput>
  readonly camera: DomainProducer<CameraProducerInput, CameraDomainOutput>
  readonly effect: DomainProducer<EffectProducerInput, EffectDomainOutput>
  readonly depth: DomainProducer<DepthProducerInput, DepthDomainOutput>
  readonly composition: DomainProducer<CompositionProducerInput, CompositionDomainOutput>
  readonly audio: DomainProducer<AudioProducerInput, AudioDomainOutput>
}

export interface CompilerDomainOutputBundle {
  readonly scene: SceneDomainOutput
  readonly timeline: TimelineDomainOutput
  readonly camera: CameraDomainOutput
  readonly effect: EffectDomainOutput
  readonly depth: DepthDomainOutput
  readonly composition: CompositionDomainOutput
  readonly audio: AudioDomainOutput
}

export interface ScenarioCompilerIssue {
  readonly code:
    | 'INVALID_COMPILER_INPUT'
    | 'INCOMPATIBLE_PLANNING_CONTEXT'
    | 'PRODUCER_GENERATION_FAILED'
    | 'INCOMPLETE_DOMAIN_OUTPUT'
  readonly message: string
  readonly domain?: ScenarioCompilerDomain
  readonly path?: string
  readonly producerIssueCode?: string
}

export type ScenarioCompilerResult =
  | { readonly success: true; readonly output: CompilerDomainOutputBundle }
  | { readonly success: false; readonly issues: readonly ScenarioCompilerIssue[] }
