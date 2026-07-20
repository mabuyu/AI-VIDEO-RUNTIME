import type { ArtifactEnvelope } from './artifactEnvelope'

export interface ArtifactEnvelopeValidationResult {
  readonly valid: boolean
  readonly issues: string[]
}

const ARTIFACT_STATUSES = new Set([
  'PENDING_VALIDATION',
  'READY',
  'FAILED',
])
const VALIDATION_STATUSES = new Set(['verified', 'failed', 'pending'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function validateOptionalString(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (value !== undefined && !isNonEmptyString(value)) {
    issues.push(`${path} must be a non-empty string when provided`)
  }
}

function validateOptionalPositiveNumber(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (value !== undefined && !isPositiveFiniteNumber(value)) {
    issues.push(`${path} must be a positive finite number when provided`)
  }
}

export function validateArtifactEnvelope(
  envelope: ArtifactEnvelope,
): ArtifactEnvelopeValidationResult {
  const issues: string[] = []
  const candidate: unknown = envelope

  if (!isRecord(candidate)) {
    return {
      valid: false,
      issues: ['artifact envelope must be an object'],
    }
  }

  if (!isNonEmptyString(candidate.artifactId)) {
    issues.push('artifactId must be a non-empty string')
  }

  if (candidate.artifactType !== 'video') {
    issues.push('artifactType must be "video"')
  }

  if (
    typeof candidate.status !== 'string' ||
    !ARTIFACT_STATUSES.has(candidate.status)
  ) {
    issues.push('status must be PENDING_VALIDATION, READY, or FAILED')
  }

  if (!isRecord(candidate.source)) {
    issues.push('source must be an object')
  } else {
    if (!isNonEmptyString(candidate.source.provider)) {
      issues.push('source.provider must be a non-empty string')
    }
    validateOptionalString(candidate.source.model, 'source.model', issues)
    validateOptionalString(
      candidate.source.generationId,
      'source.generationId',
      issues,
    )
    validateOptionalString(candidate.source.reference, 'source.reference', issues)
  }

  if (!isRecord(candidate.location)) {
    issues.push('location must be an object')
  } else {
    if (candidate.location.type !== 'local-file') {
      issues.push('location.type must be "local-file"')
    }
    if (!isNonEmptyString(candidate.location.path)) {
      issues.push('location.path must be a non-empty string')
    }
  }

  if (!isRecord(candidate.metadata)) {
    issues.push('metadata must be an object')
  } else {
    if (!isNonEmptyString(candidate.metadata.mimeType)) {
      issues.push('metadata.mimeType must be a non-empty string')
    } else if (
      candidate.artifactType === 'video' &&
      candidate.metadata.mimeType !== 'video/mp4'
    ) {
      issues.push('video metadata.mimeType must be "video/mp4"')
    }

    if (!isPositiveFiniteNumber(candidate.metadata.size)) {
      issues.push('video metadata.size must be a positive finite number')
    }

    validateOptionalPositiveNumber(
      candidate.metadata.duration,
      'metadata.duration',
      issues,
    )
    validateOptionalPositiveNumber(
      candidate.metadata.width,
      'metadata.width',
      issues,
    )
    validateOptionalPositiveNumber(
      candidate.metadata.height,
      'metadata.height',
      issues,
    )
  }

  if (!isRecord(candidate.validation)) {
    issues.push('validation must be an object')
  } else {
    if (
      typeof candidate.validation.status !== 'string' ||
      !VALIDATION_STATUSES.has(candidate.validation.status)
    ) {
      issues.push('validation.status must be verified, failed, or pending')
    }

    if (!Array.isArray(candidate.validation.checks)) {
      issues.push('validation.checks must be an array')
    } else {
      candidate.validation.checks.forEach((check, index) => {
        const path = `validation.checks[${index}]`

        if (!isRecord(check)) {
          issues.push(`${path} must be an object`)
          return
        }
        if (!isNonEmptyString(check.name)) {
          issues.push(`${path}.name must be a non-empty string`)
        }
        if (typeof check.passed !== 'boolean') {
          issues.push(`${path}.passed must be a boolean`)
        }
        validateOptionalString(check.message, `${path}.message`, issues)
      })

      if (
        candidate.validation.status === 'verified' &&
        (candidate.validation.checks.length === 0 ||
          candidate.validation.checks.some(
            (check) => !isRecord(check) || check.passed !== true,
          ))
      ) {
        issues.push(
          'validation.status verified requires at least one check and every check to pass',
        )
      }
    }

    const expectedValidationStatus =
      candidate.status === 'READY'
        ? 'verified'
        : candidate.status === 'FAILED'
          ? 'failed'
          : candidate.status === 'PENDING_VALIDATION'
            ? 'pending'
            : undefined

    if (
      expectedValidationStatus !== undefined &&
      candidate.validation.status !== expectedValidationStatus
    ) {
      issues.push(
        `status ${candidate.status} requires validation.status ${expectedValidationStatus}`,
      )
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
