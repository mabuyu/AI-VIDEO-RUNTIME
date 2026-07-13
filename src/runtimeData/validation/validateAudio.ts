import {
  createIssue,
  isRecord,
  validateFiniteNumber,
  validateRequiredString,
} from './helpers'
import type { RuntimeValidationIssue } from './types'
import { RUNTIME_VALIDATION_CODES } from './types'

interface ValidTiming {
  readonly index: number
  readonly start: number
  readonly duration: number
}

function validateTiming(
  value: Record<string, unknown>,
  path: string,
  issues: RuntimeValidationIssue[],
): value is Record<string, unknown> & { start: number; duration: number } {
  const start = value.start
  const duration = value.duration
  const startIsFinite = validateFiniteNumber(start, 'audio', `${path}.start`, issues)
  const durationIsFinite = validateFiniteNumber(
    duration,
    'audio',
    `${path}.duration`,
    issues,
  )

  if (startIsFinite && start < 0) {
    issues.push(createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.nonNegativeNumberRequired,
      domain: 'audio',
      path: `${path}.start`,
      message: `${path}.start must be non-negative`,
      expected: '>= 0',
      actual: start,
    }))
  }
  if (durationIsFinite && duration <= 0) {
    issues.push(createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.positiveNumberRequired,
      domain: 'audio',
      path: `${path}.duration`,
      message: `${path}.duration must be greater than 0`,
      expected: '> 0',
      actual: duration,
    }))
  }

  return startIsFinite && start >= 0 && durationIsFinite && duration > 0
}

function validateSegments(
  track: Record<string, unknown> & { start: number; duration: number },
  trackIndex: number,
  type: 'generated-audio' | 'silence',
  issues: RuntimeValidationIssue[],
): void {
  const path = `audio[${trackIndex}].segments`
  if (!Array.isArray(track.segments)) {
    issues.push(createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.audioSegmentsArrayRequired,
      domain: 'audio',
      path,
      message: `${path} must be an array`,
      expected: 'array',
      actual: track.segments,
    }))
    return
  }
  if (track.segments.length === 0) {
    issues.push(createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.audioSegmentsEmpty,
      domain: 'audio',
      path,
      message: `${path} must contain at least one segment`,
      expected: 'non-empty array',
      actual: track.segments,
    }))
    return
  }

  const timings: ValidTiming[] = []
  track.segments.forEach((segment, segmentIndex) => {
    const segmentPath = `${path}[${segmentIndex}]`
    if (!isRecord(segment)) {
      issues.push(createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.audioSegmentObjectRequired,
        domain: 'audio',
        path: segmentPath,
        message: `${segmentPath} must be an object`,
        expected: 'object',
        actual: segment,
      }))
      return
    }

    if (type === 'generated-audio') {
      validateRequiredString(segment.audioRef, 'audio', `${segmentPath}.audioRef`, issues)
    } else if (Object.prototype.hasOwnProperty.call(segment, 'audioRef')) {
      issues.push(createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.audioRefForbidden,
        domain: 'audio',
        path: `${segmentPath}.audioRef`,
        message: `${segmentPath} must not contain audioRef for silence`,
        expected: 'property absent',
        actual: segment.audioRef,
      }))
    }

    if (validateTiming(segment, segmentPath, issues)) {
      timings.push({ index: segmentIndex, start: segment.start, duration: segment.duration })
    }
  })

  const trackEnd = track.start + track.duration
  if (timings.length === 0) return
  if (timings[0].start !== track.start) {
    issues.push(createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.audioSegmentCoverageMismatch,
      domain: 'audio',
      path: `${path}[${timings[0].index}].start`,
      message: `${path} coverage must start at the track start`,
      expected: track.start,
      actual: timings[0].start,
    }))
  }
  for (let index = 1; index < timings.length; index += 1) {
    const previous = timings[index - 1]
    const current = timings[index]
    const previousEnd = previous.start + previous.duration
    if (current.start < previousEnd) {
      issues.push(createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.audioSegmentOverlap,
        domain: 'audio',
        path: `${path}[${current.index}].start`,
        message: `${path}[${current.index}] overlaps the previous segment`,
        expected: `>= ${previousEnd}`,
        actual: current.start,
      }))
    } else if (current.start !== previousEnd) {
      issues.push(createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.audioSegmentCoverageMismatch,
        domain: 'audio',
        path: `${path}[${current.index}].start`,
        message: `${path} coverage must be continuous`,
        expected: previousEnd,
        actual: current.start,
      }))
    }
  }
  const last = timings[timings.length - 1]
  const lastEnd = last.start + last.duration
  if (lastEnd !== trackEnd) {
    issues.push(createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.audioSegmentCoverageMismatch,
      domain: 'audio',
      path: `${path}[${last.index}].duration`,
      message: `${path} coverage must end at the track end`,
      expected: trackEnd,
      actual: lastEnd,
    }))
  }
}

export function validateAudio(audio: unknown): RuntimeValidationIssue[] {
  const issues: RuntimeValidationIssue[] = []
  if (!Array.isArray(audio)) {
    return [createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.audioArrayRequired,
      domain: 'audio',
      path: 'audio',
      message: 'audio must be an array',
      expected: 'array',
      actual: audio,
    })]
  }
  if (audio.length === 0) {
    return [createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.audioEmpty,
      domain: 'audio',
      path: 'audio',
      message: 'audio must explicitly contain generated-audio or silence',
      expected: 'non-empty array',
      actual: audio,
    })]
  }

  const seenIds = new Set<string>()
  const timings: ValidTiming[] = []
  audio.forEach((track, index) => {
    const path = `audio[${index}]`
    if (!isRecord(track)) {
      issues.push(createIssue({
        severity: 'error', code: RUNTIME_VALIDATION_CODES.audioObjectRequired,
        domain: 'audio', path, message: `${path} must be an object`, expected: 'object', actual: track,
      }))
      return
    }
    if (validateRequiredString(track.id, 'audio', `${path}.id`, issues)) {
      if (seenIds.has(track.id)) {
        issues.push(createIssue({
          severity: 'error', code: RUNTIME_VALIDATION_CODES.duplicateAudioId,
          domain: 'audio', path: `${path}.id`, message: `audio id "${track.id}" is duplicated`,
          expected: 'unique audio id', actual: track.id,
        }))
      }
      seenIds.add(track.id)
    }

    const timingIsValid = validateTiming(track, path, issues)
    if (timingIsValid) timings.push({ index, start: track.start, duration: track.duration })

    if (track.type !== 'generated-audio' && track.type !== 'silence') {
      issues.push(createIssue({
        severity: 'error', code: RUNTIME_VALIDATION_CODES.audioTypeUnsupported,
        domain: 'audio', path: `${path}.type`, message: `${path}.type is not supported`,
        expected: ['generated-audio', 'silence'], actual: track.type,
      }))
      return
    }

    const volume = track.volume
    const volumeIsFinite = validateFiniteNumber(volume, 'audio', `${path}.volume`, issues)
    if (volumeIsFinite && (volume < 0 || volume > 1)) {
      issues.push(createIssue({
        severity: 'error', code: RUNTIME_VALIDATION_CODES.audioVolumeOutOfRange,
        domain: 'audio', path: `${path}.volume`, message: `${path}.volume must be within 0..1`,
        expected: '0..1', actual: volume,
      }))
    }
    if (track.type === 'silence' && volumeIsFinite && volume !== 0) {
      issues.push(createIssue({
        severity: 'error', code: RUNTIME_VALIDATION_CODES.audioVolumeOutOfRange,
        domain: 'audio', path: `${path}.volume`, message: `${path}.volume must be 0 for silence`,
        expected: 0, actual: volume,
      }))
    }
    if (timingIsValid) validateSegments(track, index, track.type, issues)
  })

  for (let index = 1; index < timings.length; index += 1) {
    const previous = timings[index - 1]
    const current = timings[index]
    const previousEnd = previous.start + previous.duration
    if (current.start < previousEnd) {
      issues.push(createIssue({
        severity: 'error', code: RUNTIME_VALIDATION_CODES.audioOverlap,
        domain: 'audio', path: `audio[${current.index}].start`,
        message: `audio[${current.index}] overlaps audio[${previous.index}]`,
        expected: `>= ${previousEnd}`, actual: current.start,
      }))
    }
  }
  return issues
}
