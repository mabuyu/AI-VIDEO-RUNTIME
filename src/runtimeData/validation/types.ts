import type { RuntimeDataV1 } from '../types'

export type RuntimeValidationSeverity = 'error' | 'warning'

export type RuntimeValidationDomain =
  | 'runtimeData'
  | 'project'
  | 'scenes'
  | 'subtitles'
  | 'timeline'
  | 'camera'

export const RUNTIME_VALIDATION_CODES = {
  runtimeDataRequired: 'RUNTIME_DATA_REQUIRED',
  runtimeDomainRequired: 'RUNTIME_DOMAIN_REQUIRED',
  projectObjectRequired: 'PROJECT_OBJECT_REQUIRED',
  requiredString: 'REQUIRED_STRING',
  finiteNumberRequired: 'FINITE_NUMBER_REQUIRED',
  positiveNumberRequired: 'POSITIVE_NUMBER_REQUIRED',
  nonNegativeNumberRequired: 'NON_NEGATIVE_NUMBER_REQUIRED',
  scenesArrayRequired: 'SCENES_ARRAY_REQUIRED',
  scenesEmpty: 'SCENES_EMPTY',
  sceneObjectRequired: 'SCENE_OBJECT_REQUIRED',
  sceneTypeUnsupported: 'SCENE_TYPE_UNSUPPORTED',
  sceneCameraObjectRequired: 'SCENE_CAMERA_OBJECT_REQUIRED',
  sceneOverlap: 'SCENE_OVERLAP',
  sceneGap: 'SCENE_GAP',
  subtitlesArrayRequired: 'SUBTITLES_ARRAY_REQUIRED',
  subtitleObjectRequired: 'SUBTITLE_OBJECT_REQUIRED',
  duplicateSubtitleId: 'DUPLICATE_SUBTITLE_ID',
  subtitleOverlap: 'SUBTITLE_OVERLAP',
  timelineObjectRequired: 'TIMELINE_OBJECT_REQUIRED',
  timelineTracksArrayRequired: 'TIMELINE_TRACKS_ARRAY_REQUIRED',
  timelineTrackObjectRequired: 'TIMELINE_TRACK_OBJECT_REQUIRED',
  timelineTrackTypeUnsupported: 'TIMELINE_TRACK_TYPE_UNSUPPORTED',
  duplicateTimelineTrackId: 'DUPLICATE_TIMELINE_TRACK_ID',
  duplicateTimelineTrackType: 'DUPLICATE_TIMELINE_TRACK_TYPE',
  booleanRequired: 'BOOLEAN_REQUIRED',
  cameraArrayRequired: 'CAMERA_ARRAY_REQUIRED',
  cameraObjectRequired: 'CAMERA_OBJECT_REQUIRED',
  duplicateCameraId: 'DUPLICATE_CAMERA_ID',
  cameraOverlap: 'CAMERA_OVERLAP',
  projectTimelineFpsMismatch: 'PROJECT_TIMELINE_FPS_MISMATCH',
  projectTimelineDurationMismatch: 'PROJECT_TIMELINE_DURATION_MISMATCH',
  sceneOutOfTimeline: 'SCENE_OUT_OF_TIMELINE',
  subtitleOutOfTimeline: 'SUBTITLE_OUT_OF_TIMELINE',
  cameraOutOfTimeline: 'CAMERA_OUT_OF_TIMELINE',
  firstSceneStartMismatch: 'FIRST_SCENE_START_MISMATCH',
  lastSceneEndMismatch: 'LAST_SCENE_END_MISMATCH',
  cameraSceneCountMismatch: 'CAMERA_SCENE_COUNT_MISMATCH',
  cameraSceneStartMismatch: 'CAMERA_SCENE_START_MISMATCH',
  cameraSceneDurationMismatch: 'CAMERA_SCENE_DURATION_MISMATCH',
  timelineTrackRequired: 'TIMELINE_TRACK_REQUIRED',
  timelineTrackDisabled: 'TIMELINE_TRACK_DISABLED',
  timelineTrackSourceMismatch: 'TIMELINE_TRACK_SOURCE_MISMATCH',
} as const

export type RuntimeValidationIssueCode =
  (typeof RUNTIME_VALIDATION_CODES)[keyof typeof RUNTIME_VALIDATION_CODES]

export interface RuntimeValidationIssue {
  readonly severity: RuntimeValidationSeverity
  readonly code: RuntimeValidationIssueCode
  readonly domain: RuntimeValidationDomain
  readonly path: string
  readonly message: string
  readonly expected?: unknown
  readonly actual?: unknown
  readonly suggestion?: string
}

export type RuntimeDataValidationResult =
  | {
      readonly ok: true
      readonly data: RuntimeDataV1
      readonly issues: readonly RuntimeValidationIssue[]
    }
  | {
      readonly ok: false
      readonly issues: readonly RuntimeValidationIssue[]
    }
