import type { RuntimeDataV2 } from '../types'
import { createIssue, isFiniteNumber, isRecord } from './helpers'
import type {
  RuntimeDataV2ValidationResult,
  RuntimeValidationIssue,
} from './types'
import { RUNTIME_VALIDATION_CODES } from './types'
import { validateAudio } from './validateAudio'
import { validateComposition } from './validateComposition'
import { validateDepth } from './validateDepth'
import { validateEffect } from './validateEffect'
import { validateRuntimeData } from './validateRuntimeData'

const TIMELINE_DURATION_AUTHORITY_MS = 5700

const REQUIRED_V2_DOMAINS = ['effect', 'depth', 'composition', 'audio'] as const

const REQUIRED_V2_TRACKS = [
  { type: 'effect', source: 'effect.json' },
  { type: 'depth', source: 'depth.json' },
  { type: 'composition', source: 'composition.json' },
  { type: 'audio', source: 'audio.json' },
] as const

const OUT_OF_TIMELINE_CODES = {
  effect: RUNTIME_VALIDATION_CODES.effectOutOfTimeline,
  depth: RUNTIME_VALIDATION_CODES.depthOutOfTimeline,
  composition: RUNTIME_VALIDATION_CODES.compositionOutOfTimeline,
  audio: RUNTIME_VALIDATION_CODES.audioOutOfTimeline,
} as const

interface TimedItem {
  readonly start: number
  readonly duration: number
}

type V2Domain = (typeof REQUIRED_V2_DOMAINS)[number]

function isTimedItem(value: unknown): value is TimedItem {
  return (
    isRecord(value) &&
    isFiniteNumber(value.start) &&
    isFiniteNumber(value.duration)
  )
}

function addRequiredV2TrackIssues(
  timeline: Record<string, unknown>,
  issues: RuntimeValidationIssue[],
): void {
  if (!Array.isArray(timeline.tracks)) return

  for (const requiredTrack of REQUIRED_V2_TRACKS) {
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

function addV2TimelineBoundaryIssues(
  domain: V2Domain,
  items: readonly unknown[],
  timelineDuration: number,
  issues: RuntimeValidationIssue[],
): void {
  items.forEach((item, index) => {
    if (!isTimedItem(item)) return

    const end = item.start + item.duration
    if (end > timelineDuration) {
      issues.push(
        createIssue({
          severity: 'error',
          code: OUT_OF_TIMELINE_CODES[domain],
          domain,
          path: `${domain}[${index}].duration`,
          message: `${domain} ${index} ends after timeline.duration`,
          expected: `end <= ${timelineDuration}`,
          actual: end,
        }),
      )
    }
  })
}

function addDurationCoverageIssues(
  domain: V2Domain,
  items: readonly unknown[],
  timelineDuration: number,
  issues: RuntimeValidationIssue[],
): void {
  const timings = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isTimedItem(item) && item.start >= 0 && item.duration > 0)
    .map(({ item, index }) => ({
      index,
      start: (item as TimedItem).start,
      duration: (item as TimedItem).duration,
    }))
    .sort((a, b) => a.start - b.start)

  if (timings.length === 0) {
    issues.push(
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.durationCoverageMismatch,
        domain,
        path: domain,
        message: `${domain} must cover timeline.duration`,
        expected: `0..${timelineDuration}`,
        actual: 'no valid timed tracks',
      }),
    )
    return
  }

  const first = timings[0]
  if (first.start !== 0) {
    issues.push(
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.durationCoverageMismatch,
        domain,
        path: `${domain}[${first.index}].start`,
        message: `${domain} coverage must start at 0`,
        expected: 0,
        actual: first.start,
      }),
    )
  }

  for (let index = 1; index < timings.length; index += 1) {
    const previous = timings[index - 1]
    const current = timings[index]
    const previousEnd = previous.start + previous.duration

    if (current.start !== previousEnd) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.durationCoverageMismatch,
          domain,
          path: `${domain}[${current.index}].start`,
          message: `${domain} coverage must be continuous`,
          expected: previousEnd,
          actual: current.start,
        }),
      )
    }
  }

  const last = timings[timings.length - 1]
  const lastEnd = last.start + last.duration
  if (lastEnd !== timelineDuration) {
    issues.push(
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.durationCoverageMismatch,
        domain,
        path: `${domain}[${last.index}].duration`,
        message: `${domain} coverage must end at timeline.duration`,
        expected: timelineDuration,
        actual: lastEnd,
      }),
    )
  }
}

function addV2CrossDomainIssues(
  runtimeData: Record<string, unknown>,
  issues: RuntimeValidationIssue[],
): void {
  const timeline = runtimeData.timeline
  if (!isRecord(timeline)) return

  addRequiredV2TrackIssues(timeline, issues)

  if (!isFiniteNumber(timeline.duration)) return

  if (timeline.duration !== TIMELINE_DURATION_AUTHORITY_MS) {
    issues.push(
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.timelineDurationAuthorityMismatch,
        domain: 'runtimeData',
        path: 'timeline.duration',
        message: 'timeline.duration must match the RuntimeDataV2 5700ms authority rule',
        expected: TIMELINE_DURATION_AUTHORITY_MS,
        actual: timeline.duration,
      }),
    )
  }

  for (const domain of REQUIRED_V2_DOMAINS) {
    const value = runtimeData[domain]
    if (!Array.isArray(value)) continue

    addV2TimelineBoundaryIssues(domain, value, timeline.duration, issues)
    addDurationCoverageIssues(domain, value, timeline.duration, issues)
  }
}

export function validateRuntimeDataV2(runtimeData: unknown): RuntimeDataV2ValidationResult {
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
  issues.push(...validateRuntimeData(runtimeData).issues)

  for (const domain of REQUIRED_V2_DOMAINS) {
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

  if (Object.prototype.hasOwnProperty.call(runtimeData, 'effect')) {
    issues.push(...validateEffect(runtimeData.effect))
  }
  if (Object.prototype.hasOwnProperty.call(runtimeData, 'depth')) {
    issues.push(...validateDepth(runtimeData.depth))
  }
  if (Object.prototype.hasOwnProperty.call(runtimeData, 'composition')) {
    issues.push(...validateComposition(runtimeData.composition))
  }
  if (Object.prototype.hasOwnProperty.call(runtimeData, 'audio')) {
    issues.push(...validateAudio(runtimeData.audio))
  }

  addV2CrossDomainIssues(runtimeData, issues)

  if (issues.some((issue) => issue.severity === 'error')) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    data: runtimeData as unknown as RuntimeDataV2,
    issues,
  }
}
