export type CompilerDiagnosticLevel = 'error' | 'warning' | 'info'

export interface CompilerDiagnostic {
  level: CompilerDiagnosticLevel
  code: string
  message: string
  path?: string
  expected?: unknown
  actual?: unknown
  suggestion?: string
}

export interface SemanticProject {
  title: string
  author: string
  version: string
  fps: number
  width: number
  height: number
  duration: number
  background: string
}

export interface SceneCameraIntent {
  scaleFrom: number
  scaleTo: number
  xFrom: number
  xTo: number
  yFrom: number
  yTo: number
  shake: number
}

export interface SemanticScene {
  scene: 'hook' | 'problem' | 'value' | 'contrast'
  start: number
  duration: number
  text: string
  highlight: string
  background: string
  position: string
  animation: string
  camera: SceneCameraIntent
}

export interface SemanticSubtitle {
  id: string
  start: number
  duration: number
  text: string
}

export interface CompilerInput {
  project: SemanticProject
  scenes: SemanticScene[]
  subtitles: SemanticSubtitle[]
}

export interface CompiledTimelineTrack {
  id: string
  type: 'scene' | 'subtitle' | 'camera'
  source: string
  enabled: boolean
}

export interface CompiledTimeline {
  fps: number
  duration: number
  tracks: CompiledTimelineTrack[]
}

export interface CompiledCameraTrack extends SceneCameraIntent {
  id: string
  start: number
  duration: number
}

export interface CompilerOutput {
  timeline: CompiledTimeline | null
  camera: CompiledCameraTrack[] | null
  diagnostics: CompilerDiagnostic[]
}
