import type {
  CameraReader,
  ProjectReader,
  RuntimeCamera,
  RuntimeProject,
  RuntimeReaders,
  RuntimeScene,
  RuntimeSubtitle,
  SceneReader,
  SubtitleReader,
  TimelineReader,
} from '../../runtimeData'

export type SceneLifecycleState = 'enter' | 'active' | 'exit' | 'inactive'

export interface ProjectService {
  getProjectConfig(): RuntimeProject
  getProjectTitle(): string
  getProjectResolution(): {
    width: number
    height: number
  }
}

export interface PlaybackService {
  getTimelineFPS(): number
  getTimelineDuration(): number
  getTotalFrames(): number
  frameToTimeMs(frame: number): number
  timeMsToFrame(timeMs: number): number
}

export interface SceneRuntimeSnapshot {
  readonly scene: RuntimeScene | null
  readonly index: number
  readonly progress: number
  readonly lifecycle: SceneLifecycleState
  readonly isActive: boolean
}

export interface SceneService {
  getScenes(): readonly RuntimeScene[]
  getCurrentScene(timeMs: number): RuntimeScene | null
  getCurrentSceneState(timeMs: number): SceneRuntimeSnapshot
  getSceneLifecycle(timeMs: number): SceneLifecycleState
  getGlobalProgress(timeMs: number): number
}

export interface SubtitleRuntimeState {
  readonly subtitle: RuntimeSubtitle | null
  readonly isVisible: boolean
}

export interface SubtitleService {
  getCurrentSubtitle(timeMs: number): RuntimeSubtitle | null
  getCurrentSubtitleState(timeMs: number): SubtitleRuntimeState
  isSubtitleVisible(timeMs: number): boolean
}

export interface CameraRuntimeState {
  readonly camera: RuntimeCamera | null
  readonly progress: number
  readonly isActive: boolean
}

export interface CameraService {
  getCurrentCamera(timeMs: number): RuntimeCamera | null
  getCurrentCameraState(timeMs: number): CameraRuntimeState
}

export interface RuntimeServices {
  readonly project: ProjectService
  readonly playback: PlaybackService
  readonly scene: SceneService
  readonly subtitle: SubtitleService
  readonly camera: CameraService
}

export interface RuntimeServiceDependencies {
  readonly readers: RuntimeReaders
}

export interface PlaybackServiceDependencies {
  readonly timelineReader: TimelineReader
}

export interface ProjectServiceDependencies {
  readonly projectReader: ProjectReader
}

export interface SceneServiceDependencies {
  readonly sceneReader: SceneReader
}

export interface SubtitleServiceDependencies {
  readonly subtitleReader: SubtitleReader
}

export interface CameraServiceDependencies {
  readonly cameraReader: CameraReader
}
