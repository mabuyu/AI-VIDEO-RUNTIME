import type { RuntimeDataV1 } from '../types'

type RuntimeSceneSource = RuntimeDataV1['scenes'][number]
type RuntimeTimelineSource = RuntimeDataV1['timeline']

export type RuntimeProject = Readonly<RuntimeDataV1['project']>
export type RuntimeScene = Readonly<
  Omit<RuntimeSceneSource, 'camera'> & {
    camera: Readonly<RuntimeSceneSource['camera']>
  }
>
export type RuntimeSubtitle = Readonly<RuntimeDataV1['subtitles'][number]>
export type RuntimeTimelineTrack = Readonly<RuntimeTimelineSource['tracks'][number]>
export type RuntimeTimeline = Readonly<
  Omit<RuntimeTimelineSource, 'tracks'> & {
    tracks: readonly RuntimeTimelineTrack[]
  }
>
export type RuntimeTimelineTrackType = RuntimeTimelineTrack['type']
export type RuntimeCamera = Readonly<RuntimeDataV1['camera'][number]>

export interface ProjectReader {
  getProjectConfig(): RuntimeProject
  getProjectTitle(): string
  getProjectResolution(): {
    width: number
    height: number
  }
}

export interface SceneReader {
  getScenes(): readonly RuntimeScene[]
  getCurrentScene(timeMs: number): RuntimeScene | null
  getCurrentSceneIndex(timeMs: number): number
  getSceneProgress(timeMs: number, scene: RuntimeScene): number
  getGlobalProgress(timeMs: number): number
}

export interface SubtitleReader {
  getSubtitles(): readonly RuntimeSubtitle[]
  getCurrentSubtitle(timeMs: number): RuntimeSubtitle | null
}

export interface TimelineReader {
  getTimeline(): RuntimeTimeline
  getTimelineDuration(): number
  getTimelineFPS(): number
  getTimelineTracks(): readonly RuntimeTimelineTrack[]
  getEnabledTracks(): readonly RuntimeTimelineTrack[]
  getTrackByType(type: RuntimeTimelineTrackType): RuntimeTimelineTrack | null
}

export interface CameraReader {
  getCameras(): readonly RuntimeCamera[]
  getCurrentCamera(timeMs: number): RuntimeCamera | null
}

export interface RuntimeReaders {
  project: ProjectReader
  scene: SceneReader
  subtitle: SubtitleReader
  timeline: TimelineReader
  camera: CameraReader
}
