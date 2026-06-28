import {
  createIssue,
  isRecord,
  validateFiniteNumber,
  validateRequiredString,
} from './helpers'
import type { RuntimeValidationIssue } from './types'
import { RUNTIME_VALIDATION_CODES } from './types'

const TRACK_TYPES = ['scene', 'subtitle', 'camera'] as const

export function validateTimeline(timeline: unknown): RuntimeValidationIssue[] {
  const issues: RuntimeValidationIssue[] = []

  if (!isRecord(timeline)) {
    return [
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.timelineObjectRequired,
        domain: 'timeline',
        path: 'timeline',
        message: 'timeline must be an object',
        expected: 'object',
        actual: timeline,
      }),
    ]
  }

  for (const field of ['fps', 'duration'] as const) {
    const value = timeline[field]
    if (validateFiniteNumber(value, 'timeline', `timeline.${field}`, issues) && value <= 0) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.positiveNumberRequired,
          domain: 'timeline',
          path: `timeline.${field}`,
          message: `timeline.${field} must be greater than 0`,
          expected: '> 0',
          actual: value,
        }),
      )
    }
  }

  if (!Array.isArray(timeline.tracks)) {
    issues.push(
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.timelineTracksArrayRequired,
        domain: 'timeline',
        path: 'timeline.tracks',
        message: 'timeline.tracks must be an array',
        expected: 'array',
        actual: timeline.tracks,
      }),
    )
    return issues
  }

  const seenIds = new Set<string>()
  const seenTypes = new Set<string>()

  timeline.tracks.forEach((track, index) => {
    const path = `timeline.tracks[${index}]`
    if (!isRecord(track)) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.timelineTrackObjectRequired,
          domain: 'timeline',
          path,
          message: `${path} must be an object`,
          expected: 'object',
          actual: track,
        }),
      )
      return
    }

    const id = track.id
    const type = track.type
    const idIsValid = validateRequiredString(id, 'timeline', `${path}.id`, issues)
    const typeIsString = validateRequiredString(type, 'timeline', `${path}.type`, issues)
    validateRequiredString(track.source, 'timeline', `${path}.source`, issues)

    if (idIsValid) {
      if (seenIds.has(id)) {
        issues.push(
          createIssue({
            severity: 'error',
            code: RUNTIME_VALIDATION_CODES.duplicateTimelineTrackId,
            domain: 'timeline',
            path: `${path}.id`,
            message: `timeline track id "${id}" is duplicated`,
            expected: 'unique track id',
            actual: id,
          }),
        )
      }
      seenIds.add(id)
    }

    if (typeIsString) {
      if (!TRACK_TYPES.includes(type as (typeof TRACK_TYPES)[number])) {
        issues.push(
          createIssue({
            severity: 'error',
            code: RUNTIME_VALIDATION_CODES.timelineTrackTypeUnsupported,
            domain: 'timeline',
            path: `${path}.type`,
            message: `${path}.type is not supported`,
            expected: TRACK_TYPES,
            actual: type,
          }),
        )
      }

      if (seenTypes.has(type)) {
        issues.push(
          createIssue({
            severity: 'error',
            code: RUNTIME_VALIDATION_CODES.duplicateTimelineTrackType,
            domain: 'timeline',
            path: `${path}.type`,
            message: `timeline track type "${type}" is duplicated`,
            expected: 'unique track type',
            actual: type,
          }),
        )
      }
      seenTypes.add(type)
    }

    if (typeof track.enabled !== 'boolean') {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.booleanRequired,
          domain: 'timeline',
          path: `${path}.enabled`,
          message: `${path}.enabled must be a boolean`,
          expected: 'boolean',
          actual: track.enabled,
        }),
      )
    }
  })

  return issues
}
