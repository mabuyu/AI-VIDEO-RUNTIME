import {
  createIssue,
  isFiniteNumber,
  isRecord,
  validateFiniteNumber,
  validateRequiredString,
} from './helpers'
import type {
  RuntimeValidationDomain,
  RuntimeValidationIssue,
  RuntimeValidationIssueCode,
} from './types'
import { RUNTIME_VALIDATION_CODES } from './types'

interface TimedPresetValidationConfig {
  readonly domain: Extract<RuntimeValidationDomain, 'effect' | 'depth' | 'composition' | 'audio'>
  readonly arrayRequiredCode: RuntimeValidationIssueCode
  readonly objectRequiredCode: RuntimeValidationIssueCode
  readonly duplicateIdCode: RuntimeValidationIssueCode
  readonly overlapCode: RuntimeValidationIssueCode
  readonly presets: readonly string[]
}

interface ValidTiming {
  readonly index: number
  readonly start: number
  readonly duration: number
}

export function validateTimedPresetTracks(
  tracks: unknown,
  config: TimedPresetValidationConfig,
): RuntimeValidationIssue[] {
  const issues: RuntimeValidationIssue[] = []
  const { domain } = config

  if (!Array.isArray(tracks)) {
    return [
      createIssue({
        severity: 'error',
        code: config.arrayRequiredCode,
        domain,
        path: domain,
        message: `${domain} must be an array`,
        expected: 'array',
        actual: tracks,
      }),
    ]
  }

  const seenIds = new Set<string>()
  const validTimings: ValidTiming[] = []

  tracks.forEach((track, index) => {
    const path = `${domain}[${index}]`
    if (!isRecord(track)) {
      issues.push(
        createIssue({
          severity: 'error',
          code: config.objectRequiredCode,
          domain,
          path,
          message: `${path} must be an object`,
          expected: 'object',
          actual: track,
        }),
      )
      return
    }

    const id = track.id
    const idIsValid = validateRequiredString(id, domain, `${path}.id`, issues)
    if (idIsValid) {
      if (seenIds.has(id)) {
        issues.push(
          createIssue({
            severity: 'error',
            code: config.duplicateIdCode,
            domain,
            path: `${path}.id`,
            message: `${domain} id "${id}" is duplicated`,
            expected: `unique ${domain} id`,
            actual: id,
          }),
        )
      }
      seenIds.add(id)
    }

    const start = track.start
    const duration = track.duration
    const startIsFinite = validateFiniteNumber(start, domain, `${path}.start`, issues)
    const durationIsFinite = validateFiniteNumber(duration, domain, `${path}.duration`, issues)

    if (startIsFinite && start < 0) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.nonNegativeNumberRequired,
          domain,
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
          domain,
          path: `${path}.duration`,
          message: `${path}.duration must be greater than 0`,
          expected: '> 0',
          actual: duration,
        }),
      )
    }

    if (typeof track.preset !== 'string' || !config.presets.includes(track.preset)) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.presetUnsupported,
          domain,
          path: `${path}.preset`,
          message: `${path}.preset is not supported`,
          expected: config.presets,
          actual: track.preset,
        }),
      )
    }

    if (
      isFiniteNumber(track.start) &&
      track.start >= 0 &&
      isFiniteNumber(track.duration) &&
      track.duration > 0
    ) {
      validTimings.push({ index, start: track.start, duration: track.duration })
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
          code: config.overlapCode,
          domain,
          path: `${domain}[${current.index}].start`,
          message: `${domain}[${current.index}] overlaps ${domain}[${previous.index}]`,
          expected: `>= ${previousEnd}`,
          actual: current.start,
        }),
      )
    }
  }

  return issues
}
