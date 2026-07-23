import { validateVideoReference } from '../../provider'
import type {
  ArtifactHandoffIssue,
  ArtifactHandoffValidationResult,
} from '../types/artifactHandoff'

const requestKeys = Object.freeze([
  'handoffId',
  'productionJobId',
  'productionAttemptId',
  'videoReference',
])

const forbiddenFieldPrefixes = Object.freeze([
  'artifact',
  'lifecycle',
  'ready',
  'renderer',
  'runtime',
  'storage',
  'validation',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key))
}

function freezeIssues(
  issues: readonly ArtifactHandoffIssue[],
): readonly ArtifactHandoffIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ArtifactHandoffIssue[],
): ArtifactHandoffValidationResult {
  return Object.freeze({
    valid: false,
    issues: freezeIssues(issues),
  })
}

function findForbiddenField(
  value: unknown,
  path: string,
): ArtifactHandoffIssue | undefined {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const issue = findForbiddenField(item, `${path}[${index}]`)
      if (issue !== undefined) {
        return issue
      }
    }
    return undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = path.length === 0 ? key : `${path}.${key}`
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (
      forbiddenFieldPrefixes.some((prefix) =>
        normalizedKey.startsWith(prefix),
      )
    ) {
      return {
        code: 'FORBIDDEN_FIELD',
        message:
          'Production Artifact handoff cannot carry Artifact lifecycle or Runtime authority',
        path: nestedPath,
      }
    }

    const nestedIssue = findForbiddenField(nestedValue, nestedPath)
    if (nestedIssue !== undefined) {
      return nestedIssue
    }
  }

  return undefined
}

export function validateProductionArtifactHandoffRequest(
  candidate: unknown,
): ArtifactHandoffValidationResult {
  if (!isRecord(candidate)) {
    return failure([
      {
        code: 'INVALID_HANDOFF_REQUEST',
        message: 'ProductionArtifactHandoffRequest must be an object',
      },
    ])
  }

  const forbiddenIssue = findForbiddenField(candidate, '')
  if (forbiddenIssue !== undefined) {
    return failure([forbiddenIssue])
  }

  if (!hasOnlyKeys(candidate, requestKeys)) {
    return failure([
      {
        code: 'INVALID_HANDOFF_REQUEST',
        message:
          'ProductionArtifactHandoffRequest contains fields outside the boundary contract',
      },
    ])
  }

  const issues: ArtifactHandoffIssue[] = []

  if (!isNonEmptyString(candidate.handoffId)) {
    issues.push({
      code: 'INVALID_HANDOFF_ID',
      message: 'ProductionArtifactHandoffRequest requires a non-empty handoffId',
      path: 'handoffId',
    })
  }

  if (!isNonEmptyString(candidate.productionJobId)) {
    issues.push({
      code: 'INVALID_PRODUCTION_JOB_ID',
      message:
        'ProductionArtifactHandoffRequest requires a non-empty productionJobId',
      path: 'productionJobId',
    })
  }

  if (!isNonEmptyString(candidate.productionAttemptId)) {
    issues.push({
      code: 'INVALID_PRODUCTION_ATTEMPT_ID',
      message:
        'ProductionArtifactHandoffRequest requires a non-empty productionAttemptId',
      path: 'productionAttemptId',
    })
  }

  const referenceValidation = validateVideoReference(candidate.videoReference)
  if (!referenceValidation.valid) {
    issues.push({
      code: 'INVALID_VIDEO_REFERENCE',
      message:
        referenceValidation.issues[0]?.message ??
        'ProductionArtifactHandoffRequest requires a valid VideoReference',
      path: 'videoReference',
    })
  }

  return issues.length === 0
    ? Object.freeze({ valid: true })
    : failure(issues)
}

export function validateArtifactHandoffResult(
  candidate: unknown,
  expectedHandoffId?: string,
): ArtifactHandoffValidationResult {
  if (!isRecord(candidate) || typeof candidate.ok !== 'boolean') {
    return failure([
      {
        code: 'INVALID_HANDOFF_RESULT',
        message: 'ArtifactHandoffResult must be a success or failure result',
      },
    ])
  }

  const forbiddenIssue = findForbiddenField(candidate, '')
  if (forbiddenIssue !== undefined) {
    return failure([forbiddenIssue])
  }

  if (candidate.ok === true) {
    if (
      !hasOnlyKeys(candidate, ['ok', 'handoffId']) ||
      !isNonEmptyString(candidate.handoffId) ||
      (expectedHandoffId !== undefined &&
        candidate.handoffId !== expectedHandoffId)
    ) {
      return failure([
        {
          code: 'INVALID_HANDOFF_RESULT',
          message:
            'Successful ArtifactHandoffResult requires only the matching handoffId',
          path: 'handoffId',
        },
      ])
    }

    return Object.freeze({ valid: true })
  }

  if (
    !hasOnlyKeys(candidate, ['ok', 'issues']) ||
    !Array.isArray(candidate.issues) ||
    candidate.issues.length === 0 ||
    candidate.issues.some(
      (issue) =>
        !isRecord(issue) ||
        !isNonEmptyString(issue.code) ||
        !isNonEmptyString(issue.message),
    )
  ) {
    return failure([
      {
        code: 'INVALID_HANDOFF_RESULT',
        message:
          'Failed ArtifactHandoffResult requires non-empty issues and cannot expose an Artifact',
      },
    ])
  }

  return Object.freeze({ valid: true })
}
