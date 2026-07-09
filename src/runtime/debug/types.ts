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

export interface RuntimeDebugReaderSummaryV2 {
  readonly sceneCount: number
  readonly subtitleCount: number
  readonly timelineTrackCount: number
  readonly cameraCount: number
  readonly effectCount: number
  readonly depthCount: number
  readonly compositionCount: number
  readonly audioCount: number
}

export interface RuntimeDebugServiceSummaryV2 {
  readonly projectTitle: string
  readonly fps: number
  readonly duration: number
  readonly totalFrames: number
  readonly domainCount: number
}

export interface RuntimeDebugSnapshotV2 {
  readonly readiness: {
    readonly ready: true
  }
  readonly context: {
    readonly status: 'ready'
  }
  readonly bootstrap: {
    readonly ready: true
  }
  readonly readers: RuntimeDebugReaderSummaryV2
  readonly services: RuntimeDebugServiceSummaryV2
}
