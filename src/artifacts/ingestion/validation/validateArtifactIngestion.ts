import { validateVideoReference } from '../../../production/provider'
import type {
  ArtifactIngestionIssue,
  ArtifactIngestionValidationResult,
} from '../types/artifactIngestion'

const requestKeys = Object.freeze([
  'ingestionId',
  'sourceReference',
  'productionContext',
])
const productionContextKeys = Object.freeze([
  'productionJobId',
  'productionAttemptId',
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
  issues: readonly ArtifactIngestionIssue[],
): readonly ArtifactIngestionIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ArtifactIngestionIssue[],
): ArtifactIngestionValidationResult {
  return Object.freeze({
    valid: false,
    issues: freezeIssues(issues),
  })
}

function findForbiddenField(
  value: unknown,
  path: string,
): ArtifactIngestionIssue | undefined {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const issue = findForbiddenField(item, `${path}[${index}]`)
      if (issue !== undefined) return issue
    }
    return undefined
  }

  if (!isRecord(value)) return undefined

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
          'Artifact ingestion cannot accept Runtime, READY, validation, or lifecycle authority',
        path: nestedPath,
      }
    }

    const nestedIssue = findForbiddenField(nestedValue, nestedPath)
    if (nestedIssue !== undefined) return nestedIssue
  }

  return undefined
}

export function validateArtifactIngestionRequest(
  candidate: unknown,
): ArtifactIngestionValidationResult {
  if (!isRecord(candidate)) {
    return failure([
      {
        code: 'INVALID_INGESTION_REQUEST',
        message: 'ArtifactIngestionRequest must be an object',
      },
    ])
  }

  const forbiddenIssue = findForbiddenField(candidate, '')
  if (forbiddenIssue !== undefined) return failure([forbiddenIssue])

  if (!hasOnlyKeys(candidate, requestKeys)) {
    return failure([
      {
        code: 'INVALID_INGESTION_REQUEST',
        message:
          'ArtifactIngestionRequest contains fields outside the boundary contract',
      },
    ])
  }

  const issues: ArtifactIngestionIssue[] = []

  if (!isNonEmptyString(candidate.ingestionId)) {
    issues.push({
      code: 'INVALID_INGESTION_ID',
      message: 'ArtifactIngestionRequest requires a non-empty ingestionId',
      path: 'ingestionId',
    })
  }

  const referenceValidation = validateVideoReference(candidate.sourceReference)
  if (!referenceValidation.valid) {
    issues.push({
      code: 'INVALID_SOURCE_REFERENCE',
      message:
        referenceValidation.issues[0]?.message ??
        'ArtifactIngestionRequest requires a valid sourceReference',
      path: 'sourceReference',
    })
  }

  if (
    !isRecord(candidate.productionContext) ||
    !hasOnlyKeys(candidate.productionContext, productionContextKeys)
  ) {
    issues.push({
      code: 'INVALID_PRODUCTION_CONTEXT',
      message:
        'productionContext may contain only productionJobId and productionAttemptId',
      path: 'productionContext',
    })
  } else {
    if (!isNonEmptyString(candidate.productionContext.productionJobId)) {
      issues.push({
        code: 'INVALID_PRODUCTION_CONTEXT',
        message: 'productionContext.productionJobId must be non-empty',
        path: 'productionContext.productionJobId',
      })
    }
    if (!isNonEmptyString(candidate.productionContext.productionAttemptId)) {
      issues.push({
        code: 'INVALID_PRODUCTION_CONTEXT',
        message: 'productionContext.productionAttemptId must be non-empty',
        path: 'productionContext.productionAttemptId',
      })
    }
  }

  return issues.length === 0
    ? Object.freeze({ valid: true })
    : failure(issues)
}

export function validateArtifactIngestionResult(
  candidate: unknown,
): ArtifactIngestionValidationResult {
  if (!isRecord(candidate) || typeof candidate.ok !== 'boolean') {
    return failure([
      {
        code: 'INVALID_INGESTION_RESULT',
        message: 'ArtifactIngestionResult must be a success or failure result',
      },
    ])
  }

  const forbiddenIssue = findForbiddenField(candidate, '')
  if (forbiddenIssue !== undefined) return failure([forbiddenIssue])

  if (candidate.ok === true) {
    if (
      !hasOnlyKeys(candidate, ['ok', 'candidateId']) ||
      !isNonEmptyString(candidate.candidateId)
    ) {
      return failure([
        {
          code: 'INVALID_INGESTION_RESULT',
          message:
            'Successful ArtifactIngestionResult requires only a non-empty candidateId',
          path: 'candidateId',
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
        code: 'INVALID_INGESTION_RESULT',
        message:
          'Failed ArtifactIngestionResult requires non-empty issues and cannot expose partial Artifact state',
      },
    ])
  }

  return Object.freeze({ valid: true })
}
