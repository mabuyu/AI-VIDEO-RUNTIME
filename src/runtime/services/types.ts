import type {
  AudioReader,
  CameraReader,
  CompositionReader,
  DepthReader,
  EffectReader,
  ProjectReader,
  RuntimeAudio,
  RuntimeCamera,
  RuntimeComposition,
  RuntimeDataV2Readers,
  RuntimeDepth,
  RuntimeEffect,
  RuntimeProject,
  RuntimeReaders,
  RuntimeScene,
  RuntimeSubtitle,
  SceneReader,
  SubtitleReader,
  TimelineReader,
} from '../../runtimeData'
import type {
  RuntimeArtifactConsumptionAdapter,
  RuntimeArtifactService,
} from './artifact'

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
  readonly artifact: RuntimeArtifactService
}

export interface TimedRuntimeState<T> {
  readonly track: T | null
  readonly progress: number
  readonly isActive: boolean
}

export type EffectRuntimeState = TimedRuntimeState<RuntimeEffect>
export type DepthRuntimeState = TimedRuntimeState<RuntimeDepth>
export type CompositionRuntimeState = TimedRuntimeState<RuntimeComposition>
export type AudioRuntimeState = TimedRuntimeState<RuntimeAudio>

export interface EffectService {
  getEffects(): readonly RuntimeEffect[]
  getCurrentEffect(timeMs: number): RuntimeEffect | null
  getCurrentEffectState(timeMs: number): EffectRuntimeState
}

export interface DepthService {
  getDepthTracks(): readonly RuntimeDepth[]
  getCurrentDepth(timeMs: number): RuntimeDepth | null
  getCurrentDepthState(timeMs: number): DepthRuntimeState
}

export interface CompositionService {
  getCompositions(): readonly RuntimeComposition[]
  getCurrentComposition(timeMs: number): RuntimeComposition | null
  getCurrentCompositionState(timeMs: number): CompositionRuntimeState
}

export interface AudioService {
  getAudioTracks(): readonly RuntimeAudio[]
  getCurrentAudio(timeMs: number): RuntimeAudio | null
  getCurrentAudioState(timeMs: number): AudioRuntimeState
}

export interface RuntimeDataV2Services extends RuntimeServices {
  readonly effect: EffectService
  readonly depth: DepthService
  readonly composition: CompositionService
  readonly audio: AudioService
}

export interface RuntimeServiceDependencies {
  readonly readers: RuntimeReaders
  readonly artifactConsumptionAdapter?: RuntimeArtifactConsumptionAdapter
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

export interface EffectServiceDependencies {
  readonly effectReader: EffectReader
}

export interface DepthServiceDependencies {
  readonly depthReader: DepthReader
}

export interface CompositionServiceDependencies {
  readonly compositionReader: CompositionReader
}

export interface AudioServiceDependencies {
  readonly audioReader: AudioReader
}

export interface RuntimeDataV2ServiceDependencies {
  readonly readers: RuntimeDataV2Readers
}
