import type {
  CompiledCameraTrack,
  CompiledTimeline,
  CompilerDiagnostic,
  SemanticProject,
  SemanticScene,
  SemanticSubtitle,
} from '../compiler'

export interface RuntimeDataV1 {
  readonly project: SemanticProject
  readonly scenes: readonly SemanticScene[]
  readonly subtitles: readonly SemanticSubtitle[]
  readonly timeline: CompiledTimeline
  readonly camera: readonly CompiledCameraTrack[]
}

export type RuntimeEffectPreset = 'cinematic' | 'dramatic' | 'clean' | 'dream'
export type RuntimeDepthPreset = 'near' | 'balanced' | 'deep' | 'cinematic'
export type RuntimeCompositionPreset = 'hook' | 'problem' | 'value' | 'contrast'
export interface RuntimeEffectTrack {
  readonly id: string
  readonly start: number
  readonly duration: number
  readonly preset: RuntimeEffectPreset
}

export interface RuntimeDepthTrack {
  readonly id: string
  readonly start: number
  readonly duration: number
  readonly preset: RuntimeDepthPreset
}

export interface RuntimeCompositionTrack {
  readonly id: string
  readonly start: number
  readonly duration: number
  readonly preset: RuntimeCompositionPreset
}

export interface RuntimeGeneratedAudioSegment {
  readonly start: number
  readonly duration: number
  readonly audioRef: string
}

export interface RuntimeSilenceAudioSegment {
  readonly start: number
  readonly duration: number
}

interface RuntimeAudioTrackBase {
  readonly id: string
  readonly start: number
  readonly duration: number
}

export interface RuntimeGeneratedAudioTrack extends RuntimeAudioTrackBase {
  readonly type: 'generated-audio'
  readonly volume: number
  readonly segments: readonly RuntimeGeneratedAudioSegment[]
}

export interface RuntimeSilenceAudioTrack extends RuntimeAudioTrackBase {
  readonly type: 'silence'
  readonly volume: 0
  readonly segments: readonly RuntimeSilenceAudioSegment[]
}

export type RuntimeAudioTrack =
  | RuntimeGeneratedAudioTrack
  | RuntimeSilenceAudioTrack

export interface RuntimeDataV2 extends RuntimeDataV1 {
  readonly effect: readonly RuntimeEffectTrack[]
  readonly depth: readonly RuntimeDepthTrack[]
  readonly composition: readonly RuntimeCompositionTrack[]
  readonly audio: readonly RuntimeAudioTrack[]
}

export type RuntimeDataAdapterDiagnosticCode =
  | 'TIMELINE_MISSING'
  | 'CAMERA_MISSING'
  | 'TIMELINE_FPS_MISMATCH'
  | 'TIMELINE_DURATION_MISMATCH'
  | 'CAMERA_COUNT_MISMATCH'
  | 'CAMERA_START_MISMATCH'
  | 'CAMERA_DURATION_MISMATCH'

export interface RuntimeDataAdapterDiagnostic {
  readonly source: 'compiler' | 'adapter'
  readonly level: CompilerDiagnostic['level']
  readonly code: RuntimeDataAdapterDiagnosticCode | string
  readonly message: string
  readonly path?: string
  readonly expected?: unknown
  readonly actual?: unknown
  readonly suggestion?: string
}

export type RuntimeDataAdapterResult =
  | {
      readonly ok: true
      readonly data: RuntimeDataV1
      readonly diagnostics: readonly RuntimeDataAdapterDiagnostic[]
    }
  | {
      readonly ok: false
      readonly diagnostics: readonly RuntimeDataAdapterDiagnostic[]
    }
