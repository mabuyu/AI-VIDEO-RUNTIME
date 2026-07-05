import type { RuntimeDataSourceKind, RuntimeValidationIssue } from '../../runtimeData'
import type {
  CameraRuntimeState,
  SceneRuntimeSnapshot,
  SubtitleRuntimeState,
} from '../services'

export interface RuntimeDebugProjectMetadata {
  readonly title: string
  readonly author: string
  readonly version: string
  readonly width: number
  readonly height: number
  readonly duration: number
  readonly background: string
}

export interface RuntimeDebugSceneState extends SceneRuntimeSnapshot {
  readonly globalProgress: number
}

export interface RuntimeDebugSnapshot {
  readonly sourceKind: RuntimeDataSourceKind
  readonly validationWarnings: readonly RuntimeValidationIssue[]
  readonly project: RuntimeDebugProjectMetadata
  readonly fps: number
  readonly duration: number
  readonly frame: number
  readonly timeMs: number
  readonly scene: RuntimeDebugSceneState
  readonly subtitle: SubtitleRuntimeState
  readonly camera: CameraRuntimeState
}
