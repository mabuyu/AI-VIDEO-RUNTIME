import {
  createIssue,
  isFiniteNumber,
  isRecord,
  validateFiniteNumber,
  validateRequiredString,
} from './helpers'
import type { RuntimeValidationIssue } from './types'
import { RUNTIME_VALIDATION_CODES } from './types'

interface ValidSubtitleTiming {
  readonly index: number
  readonly start: number
  readonly duration: number
}

export function validateSubtitles(subtitles: unknown): RuntimeValidationIssue[] {
  const issues: RuntimeValidationIssue[] = []

  if (!Array.isArray(subtitles)) {
    return [
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.subtitlesArrayRequired,
        domain: 'subtitles',
        path: 'subtitles',
        message: 'subtitles must be an array',
        expected: 'array',
        actual: subtitles,
      }),
    ]
  }

  const seenIds = new Set<string>()
  const validTimings: ValidSubtitleTiming[] = []

  subtitles.forEach((subtitle, index) => {
    const path = `subtitles[${index}]`
    if (!isRecord(subtitle)) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.subtitleObjectRequired,
          domain: 'subtitles',
          path,
          message: `${path} must be an object`,
          expected: 'object',
          actual: subtitle,
        }),
      )
      return
    }

    const id = subtitle.id
    const idIsValid = validateRequiredString(id, 'subtitles', `${path}.id`, issues)
    validateRequiredString(subtitle.text, 'subtitles', `${path}.text`, issues)

    if (idIsValid) {
      if (seenIds.has(id)) {
        issues.push(
          createIssue({
            severity: 'error',
            code: RUNTIME_VALIDATION_CODES.duplicateSubtitleId,
            domain: 'subtitles',
            path: `${path}.id`,
            message: `subtitle id "${id}" is duplicated`,
            expected: 'unique subtitle id',
            actual: id,
          }),
        )
      }
      seenIds.add(id)
    }

    const start = subtitle.start
    const duration = subtitle.duration
    const startIsFinite = validateFiniteNumber(start, 'subtitles', `${path}.start`, issues)
    const durationIsFinite = validateFiniteNumber(duration, 'subtitles', `${path}.duration`, issues)

    if (startIsFinite && start < 0) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.nonNegativeNumberRequired,
          domain: 'subtitles',
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
          domain: 'subtitles',
          path: `${path}.duration`,
          message: `${path}.duration must be greater than 0`,
          expected: '> 0',
          actual: duration,
        }),
      )
    }

    if (
      isFiniteNumber(subtitle.start) &&
      subtitle.start >= 0 &&
      isFiniteNumber(subtitle.duration) &&
      subtitle.duration > 0
    ) {
      validTimings.push({ index, start: subtitle.start, duration: subtitle.duration })
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
          code: RUNTIME_VALIDATION_CODES.subtitleOverlap,
          domain: 'subtitles',
          path: `subtitles[${current.index}].start`,
          message: `subtitles[${current.index}] overlaps subtitles[${previous.index}]`,
          expected: `>= ${previousEnd}`,
          actual: current.start,
        }),
      )
    }
  }

  return issues
}
