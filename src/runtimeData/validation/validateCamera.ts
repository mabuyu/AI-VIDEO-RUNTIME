import {
  createIssue,
  isFiniteNumber,
  isRecord,
  validateFiniteNumber,
  validateRequiredString,
} from './helpers'
import type { RuntimeValidationIssue } from './types'
import { RUNTIME_VALIDATION_CODES } from './types'

const CAMERA_NUMBER_FIELDS = [
  'scaleFrom',
  'scaleTo',
  'xFrom',
  'xTo',
  'yFrom',
  'yTo',
  'shake',
] as const

interface ValidCameraTiming {
  readonly index: number
  readonly start: number
  readonly duration: number
}

export function validateCamera(camera: unknown): RuntimeValidationIssue[] {
  const issues: RuntimeValidationIssue[] = []

  if (!Array.isArray(camera)) {
    return [
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.cameraArrayRequired,
        domain: 'camera',
        path: 'camera',
        message: 'camera must be an array',
        expected: 'array',
        actual: camera,
      }),
    ]
  }

  const seenIds = new Set<string>()
  const validTimings: ValidCameraTiming[] = []

  camera.forEach((cameraTrack, index) => {
    const path = `camera[${index}]`
    if (!isRecord(cameraTrack)) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.cameraObjectRequired,
          domain: 'camera',
          path,
          message: `${path} must be an object`,
          expected: 'object',
          actual: cameraTrack,
        }),
      )
      return
    }

    const id = cameraTrack.id
    const idIsValid = validateRequiredString(id, 'camera', `${path}.id`, issues)
    if (idIsValid) {
      if (seenIds.has(id)) {
        issues.push(
          createIssue({
            severity: 'error',
            code: RUNTIME_VALIDATION_CODES.duplicateCameraId,
            domain: 'camera',
            path: `${path}.id`,
            message: `camera id "${id}" is duplicated`,
            expected: 'unique camera id',
            actual: id,
          }),
        )
      }
      seenIds.add(id)
    }

    const start = cameraTrack.start
    const duration = cameraTrack.duration
    const startIsFinite = validateFiniteNumber(start, 'camera', `${path}.start`, issues)
    const durationIsFinite = validateFiniteNumber(duration, 'camera', `${path}.duration`, issues)

    if (startIsFinite && start < 0) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.nonNegativeNumberRequired,
          domain: 'camera',
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
          domain: 'camera',
          path: `${path}.duration`,
          message: `${path}.duration must be greater than 0`,
          expected: '> 0',
          actual: duration,
        }),
      )
    }

    for (const field of CAMERA_NUMBER_FIELDS) {
      validateFiniteNumber(cameraTrack[field], 'camera', `${path}.${field}`, issues)
    }

    if (
      isFiniteNumber(cameraTrack.start) &&
      cameraTrack.start >= 0 &&
      isFiniteNumber(cameraTrack.duration) &&
      cameraTrack.duration > 0
    ) {
      validTimings.push({
        index,
        start: cameraTrack.start,
        duration: cameraTrack.duration,
      })
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
          code: RUNTIME_VALIDATION_CODES.cameraOverlap,
          domain: 'camera',
          path: `camera[${current.index}].start`,
          message: `camera[${current.index}] overlaps camera[${previous.index}]`,
          expected: `>= ${previousEnd}`,
          actual: current.start,
        }),
      )
    }
  }

  return issues
}
