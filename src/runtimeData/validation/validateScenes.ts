import {
  createIssue,
  isFiniteNumber,
  isRecord,
  validateFiniteNumber,
  validateRequiredString,
} from './helpers'
import type { RuntimeValidationIssue } from './types'
import { RUNTIME_VALIDATION_CODES } from './types'

const SCENE_TYPES = ['hook', 'problem', 'value', 'contrast'] as const
const STRING_FIELDS = ['text', 'highlight', 'background', 'position', 'animation'] as const
const CAMERA_FIELDS = [
  'scaleFrom',
  'scaleTo',
  'xFrom',
  'xTo',
  'yFrom',
  'yTo',
  'shake',
] as const

interface ValidSceneTiming {
  readonly index: number
  readonly start: number
  readonly duration: number
}

export function validateScenes(scenes: unknown): RuntimeValidationIssue[] {
  const issues: RuntimeValidationIssue[] = []

  if (!Array.isArray(scenes)) {
    return [
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.scenesArrayRequired,
        domain: 'scenes',
        path: 'scenes',
        message: 'scenes must be an array',
        expected: 'non-empty array',
        actual: scenes,
      }),
    ]
  }

  if (scenes.length === 0) {
    issues.push(
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.scenesEmpty,
        domain: 'scenes',
        path: 'scenes',
        message: 'scenes must not be empty',
        expected: 'at least one scene',
        actual: 0,
      }),
    )
  }

  const validTimings: ValidSceneTiming[] = []

  scenes.forEach((scene, index) => {
    const path = `scenes[${index}]`
    if (!isRecord(scene)) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.sceneObjectRequired,
          domain: 'scenes',
          path,
          message: `${path} must be an object`,
          expected: 'object',
          actual: scene,
        }),
      )
      return
    }

    if (typeof scene.scene !== 'string' || !SCENE_TYPES.includes(scene.scene as (typeof SCENE_TYPES)[number])) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.sceneTypeUnsupported,
          domain: 'scenes',
          path: `${path}.scene`,
          message: `${path}.scene is not supported`,
          expected: SCENE_TYPES,
          actual: scene.scene,
        }),
      )
    }

    const start = scene.start
    const duration = scene.duration
    const startIsFinite = validateFiniteNumber(start, 'scenes', `${path}.start`, issues)
    const durationIsFinite = validateFiniteNumber(duration, 'scenes', `${path}.duration`, issues)

    if (startIsFinite && start < 0) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.nonNegativeNumberRequired,
          domain: 'scenes',
          path: `${path}.start`,
          message: `${path}.start must be non-negative`,
          expected: '>= 0',
          actual: start,
        }),
      )
    }

    if (durationIsFinite && duration <= 0) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.positiveNumberRequired,
          domain: 'scenes',
          path: `${path}.duration`,
          message: `${path}.duration must be greater than 0`,
          expected: '> 0',
          actual: duration,
        }),
      )
    }

    for (const field of STRING_FIELDS) {
      validateRequiredString(scene[field], 'scenes', `${path}.${field}`, issues)
    }

    if (!isRecord(scene.camera)) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.sceneCameraObjectRequired,
          domain: 'scenes',
          path: `${path}.camera`,
          message: `${path}.camera must be an object`,
          expected: 'object',
          actual: scene.camera,
        }),
      )
    } else {
      for (const field of CAMERA_FIELDS) {
        validateFiniteNumber(scene.camera[field], 'scenes', `${path}.camera.${field}`, issues)
      }
    }

    if (
      isFiniteNumber(scene.start) &&
      scene.start >= 0 &&
      isFiniteNumber(scene.duration) &&
      scene.duration > 0
    ) {
      validTimings.push({ index, start: scene.start, duration: scene.duration })
    }
  })

  for (let index = 1; index < validTimings.length; index += 1) {
    const previous = validTimings[index - 1]
    const current = validTimings[index]
    const previousEnd = previous.start + previous.duration

    if (current.start < previousEnd) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.sceneOverlap,
          domain: 'scenes',
          path: `scenes[${current.index}].start`,
          message: `scenes[${current.index}] overlaps scenes[${previous.index}]`,
          expected: `>= ${previousEnd}`,
          actual: current.start,
        }),
      )
    } else if (current.start > previousEnd) {
      issues.push(
        createIssue({
          severity: 'warning',
          code: RUNTIME_VALIDATION_CODES.sceneGap,
          domain: 'scenes',
          path: `scenes[${current.index}].start`,
          message: `scenes[${current.index}] starts after scenes[${previous.index}] ends`,
          expected: previousEnd,
          actual: current.start,
          suggestion: 'Confirm the gap is intentional or make the scenes continuous.',
        }),
      )
    }
  }

  return issues
}
