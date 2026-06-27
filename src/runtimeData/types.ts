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
