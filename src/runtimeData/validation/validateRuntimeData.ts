import type { RuntimeDataV1 } from '../types'
import { createIssue, isFiniteNumber, isRecord } from './helpers'
import type {
  RuntimeDataValidationResult,
  RuntimeValidationIssue,
  RuntimeValidationIssueCode,
} from './types'
import { RUNTIME_VALIDATION_CODES } from './types'
import { validateCamera } from './validateCamera'
import { validateProject } from './validateProject'
import { validateScenes } from './validateScenes'
import { validateSubtitles } from './validateSubtitles'
import { validateTimeline } from './validateTimeline'

const REQUIRED_DOMAINS = ['project', 'scenes', 'subtitles', 'timeline', 'camera'] as const

const REQUIRED_TRACKS = [
  { type: 'scene', source: 'scenes.json' },
  { type: 'subtitle', source: 'subtitles.json' },
  { type: 'camera', source: 'camera.json' },
] as const

interface TimedItem {
  readonly start: number
  readonly duration: number
}

function isTimedItem(value: unknown): value is TimedItem {
  return (
    isRecord(value) &&
    isFiniteNumber(value.start) &&
    isFiniteNumber(value.duration)
  )
}

function addTimelineBoundaryIssues(
  items: readonly unknown[],
  timelineDuration: number,
  domain: 'scenes' | 'subtitles' | 'camera',
  code: RuntimeValidationIssueCode,
  issues: RuntimeValidationIssue[],
): void {
  const itemName = domain === 'scenes' ? 'scene' : domain === 'subtitles' ? 'subtitle' : 'camera'

  items.forEach((item, index) => {
    if (!isTimedItem(item)) return

    const end = item.start + item.duration
    if (end > timelineDuration) {
      issues.push(
        createIssue({
          severity: 'error',
          code,
          domain,
          path: `${domain}[${index}].duration`,
          message: `${itemName} ${index} ends after timeline.duration`,
          expected: `end <= ${timelineDuration}`,
          actual: end,
        }),
      )
    }
  })
}

function addRequiredTrackIssues(
  timeline: Record<string, unknown>,
  issues: RuntimeValidationIssue[],
): void {
  if (!Array.isArray(timeline.tracks)) return

  for (const requiredTrack of REQUIRED_TRACKS) {
    const trackIndex = timeline.tracks.findIndex(
      (track) => isRecord(track) && track.type === requiredTrack.type,
    )

    if (trackIndex === -1) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.timelineTrackRequired,
          domain: 'timeline',
          path: 'timeline.tracks',
          message: `timeline must register the ${requiredTrack.type} track`,
          expected: requiredTrack,
          actual: timeline.tracks,
        }),
      )
      continue
    }

    const track = timeline.tracks[trackIndex]
    if (!isRecord(track)) continue

    if (track.source !== requiredTrack.source) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.timelineTrackSourceMismatch,
          domain: 'timeline',
          path: `timeline.tracks[${trackIndex}].source`,
          message: `${requiredTrack.type} track source must be ${requiredTrack.source}`,
          expected: requiredTrack.source,
          actual: track.source,
        }),
      )
    }

    if (track.enabled === false) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.timelineTrackDisabled,
          domain: 'timeline',
          path: `timeline.tracks[${trackIndex}].enabled`,
          message: `${requiredTrack.type} track must be enabled`,
          expected: true,
          actual: false,
        }),
      )
    }
  }
}

function addCrossDomainIssues(
  runtimeData: Record<string, unknown>,
  issues: RuntimeValidationIssue[],
): void {
  const project = runtimeData.project
  const scenes = runtimeData.scenes
  const subtitles = runtimeData.subtitles
  const timeline = runtimeData.timeline
  const camera = runtimeData.camera

  if (isRecord(project) && isRecord(timeline)) {
    if (isFiniteNumber(project.fps) && isFiniteNumber(timeline.fps) && project.fps !== timeline.fps) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.projectTimelineFpsMismatch,
          domain: 'runtimeData',
          path: 'timeline.fps',
          message: 'timeline.fps must match project.fps',
          expected: project.fps,
          actual: timeline.fps,
        }),
      )
    }

    if (
      isFiniteNumber(project.duration) &&
      isFiniteNumber(timeline.duration) &&
      project.duration !== timeline.duration
    ) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.projectTimelineDurationMismatch,
          domain: 'runtimeData',
          path: 'timeline.duration',
          message: 'timeline.duration must match project.duration',
          expected: project.duration,
          actual: timeline.duration,
        }),
      )
    }
  }

  if (isRecord(timeline)) {
    addRequiredTrackIssues(timeline, issues)

    if (isFiniteNumber(timeline.duration)) {
      if (Array.isArray(scenes)) {
        addTimelineBoundaryIssues(
          scenes,
          timeline.duration,
          'scenes',
          RUNTIME_VALIDATION_CODES.sceneOutOfTimeline,
          issues,
        )

        const firstScene = scenes[0]
        if (isTimedItem(firstScene) && firstScene.start !== 0) {
          issues.push(
            createIssue({
              severity: 'error',
              code: RUNTIME_VALIDATION_CODES.firstSceneStartMismatch,
              domain: 'runtimeData',
              path: 'scenes[0].start',
              message: 'the first scene must start at 0',
              expected: 0,
              actual: firstScene.start,
            }),
          )
        }

        const lastSceneIndex = scenes.length - 1
        const lastScene = scenes[lastSceneIndex]
        if (isTimedItem(lastScene)) {
          const lastSceneEnd = lastScene.start + lastScene.duration
          if (lastSceneEnd !== timeline.duration) {
            issues.push(
              createIssue({
                severity: 'error',
                code: RUNTIME_VALIDATION_CODES.lastSceneEndMismatch,
                domain: 'runtimeData',
                path: `scenes[${lastSceneIndex}].duration`,
                message: 'the last scene must end at timeline.duration',
                expected: timeline.duration,
                actual: lastSceneEnd,
              }),
            )
          }
        }
      }

      if (Array.isArray(subtitles)) {
        addTimelineBoundaryIssues(
          subtitles,
          timeline.duration,
          'subtitles',
          RUNTIME_VALIDATION_CODES.subtitleOutOfTimeline,
          issues,
        )
      }

      if (Array.isArray(camera)) {
        addTimelineBoundaryIssues(
          camera,
          timeline.duration,
          'camera',
          RUNTIME_VALIDATION_CODES.cameraOutOfTimeline,
          issues,
        )
      }
    }
  }

  if (Array.isArray(scenes) && Array.isArray(camera)) {
    if (camera.length !== scenes.length) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.cameraSceneCountMismatch,
          domain: 'runtimeData',
          path: 'camera',
          message: 'camera track count must match scene count',
          expected: scenes.length,
          actual: camera.length,
        }),
      )
    }

    const comparableCount = Math.min(scenes.length, camera.length)
    for (let index = 0; index < comparableCount; index += 1) {
      const scene = scenes[index]
      const cameraTrack = camera[index]
      if (!isTimedItem(scene) || !isTimedItem(cameraTrack)) continue

      if (cameraTrack.start !== scene.start) {
        issues.push(
          createIssue({
            severity: 'error',
            code: RUNTIME_VALIDATION_CODES.cameraSceneStartMismatch,
            domain: 'runtimeData',
            path: `camera[${index}].start`,
            message: `camera[${index}].start must match scenes[${index}].start`,
            expected: scene.start,
            actual: cameraTrack.start,
          }),
        )
      }

      if (cameraTrack.duration !== scene.duration) {
        issues.push(
          createIssue({
            severity: 'error',
            code: RUNTIME_VALIDATION_CODES.cameraSceneDurationMismatch,
            domain: 'runtimeData',
            path: `camera[${index}].duration`,
            message: `camera[${index}].duration must match scenes[${index}].duration`,
            expected: scene.duration,
            actual: cameraTrack.duration,
          }),
        )
      }
    }
  }
}

export function validateRuntimeData(runtimeData: unknown): RuntimeDataValidationResult {
  if (!isRecord(runtimeData)) {
    return {
      ok: false,
      issues: [
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.runtimeDataRequired,
          domain: 'runtimeData',
          path: 'runtimeData',
          message: 'runtimeData must be an object',
          expected: 'object',
          actual: runtimeData,
        }),
      ],
    }
  }

  const issues: RuntimeValidationIssue[] = []

  for (const domain of REQUIRED_DOMAINS) {
    if (!Object.prototype.hasOwnProperty.call(runtimeData, domain)) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.runtimeDomainRequired,
          domain: 'runtimeData',
          path: domain,
          message: `runtimeData.${domain} is required`,
          expected: domain,
          actual: undefined,
        }),
      )
    }
  }

  if (Object.prototype.hasOwnProperty.call(runtimeData, 'project')) {
    issues.push(...validateProject(runtimeData.project))
  }
  if (Object.prototype.hasOwnProperty.call(runtimeData, 'scenes')) {
    issues.push(...validateScenes(runtimeData.scenes))
  }
  if (Object.prototype.hasOwnProperty.call(runtimeData, 'subtitles')) {
    issues.push(...validateSubtitles(runtimeData.subtitles))
  }
  if (Object.prototype.hasOwnProperty.call(runtimeData, 'timeline')) {
    issues.push(...validateTimeline(runtimeData.timeline))
  }
  if (Object.prototype.hasOwnProperty.call(runtimeData, 'camera')) {
    issues.push(...validateCamera(runtimeData.camera))
  }

  addCrossDomainIssues(runtimeData, issues)

  if (issues.some((issue) => issue.severity === 'error')) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    data: runtimeData as unknown as RuntimeDataV1,
    issues,
  }
}
