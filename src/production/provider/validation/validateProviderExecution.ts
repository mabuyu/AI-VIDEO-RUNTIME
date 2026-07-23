import type {
  GenerationRequest,
  ProviderExecutionIssue,
  ProviderExecutionResult,
  ProviderExecutionValidationResult,
} from '../types/providerExecution'
import type {
  ProviderMetadataValue,
  VideoReference,
} from '../types/videoReference'

const generationRequestKeys = Object.freeze([
  'requestId',
  'generationIntent',
  'outputSpecification',
])
const outputSpecificationKeys = Object.freeze(['mediaType', 'format'])
const videoReferenceKeys = Object.freeze([
  'referenceId',
  'sourceType',
  'location',
  'metadata',
])

const forbiddenFieldPrefixes = Object.freeze([
  'artifact',
  'lifecycle',
  'renderer',
  'runtime',
  'validation',
])

const forbiddenFieldNames = new Set(['ready', 'status'])

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
  issues: readonly ProviderExecutionIssue[],
): readonly ProviderExecutionIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ProviderExecutionIssue[],
): ProviderExecutionValidationResult {
  return Object.freeze({
    valid: false,
    issues: freezeIssues(issues),
  })
}

function findForbiddenField(
  value: unknown,
  path: string,
): ProviderExecutionIssue | undefined {
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
      forbiddenFieldNames.has(normalizedKey) ||
      forbiddenFieldPrefixes.some((prefix) => normalizedKey.startsWith(prefix))
    ) {
      return {
        code: 'FORBIDDEN_FIELD',
        message: 'Provider execution contracts cannot carry Artifact or Runtime authority',
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

function isProviderMetadataValue(value: unknown): value is ProviderMetadataValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.every(isProviderMetadataValue)
  }

  return (
    isRecord(value) &&
    Object.values(value).every(isProviderMetadataValue)
  )
}

export function validateGenerationRequest(
  candidate: unknown,
): ProviderExecutionValidationResult {
  if (!isRecord(candidate) || !hasOnlyKeys(candidate, generationRequestKeys)) {
    return failure([
      {
        code: 'INVALID_REQUEST',
        message: 'GenerationRequest must contain only the boundary contract fields',
      },
    ])
  }

  const forbiddenIssue = findForbiddenField(candidate, '')
  if (forbiddenIssue !== undefined) {
    return failure([forbiddenIssue])
  }

  const issues: ProviderExecutionIssue[] = []

  if (!isNonEmptyString(candidate.requestId)) {
    issues.push({
      code: 'INVALID_REQUEST',
      message: 'GenerationRequest requires a non-empty requestId',
      path: 'requestId',
    })
  }

  if (!isNonEmptyString(candidate.generationIntent)) {
    issues.push({
      code: 'INVALID_GENERATION_INTENT',
      message: 'GenerationRequest requires a non-empty generationIntent',
      path: 'generationIntent',
    })
  }

  if (
    !isRecord(candidate.outputSpecification) ||
    !hasOnlyKeys(candidate.outputSpecification, outputSpecificationKeys) ||
    candidate.outputSpecification.mediaType !== 'video' ||
    !isNonEmptyString(candidate.outputSpecification.format)
  ) {
    issues.push({
      code: 'INVALID_OUTPUT_SPECIFICATION',
      message:
        'GenerationRequest outputSpecification requires video mediaType and a non-empty format',
      path: 'outputSpecification',
    })
  }

  return issues.length === 0
    ? Object.freeze({ valid: true })
    : failure(issues)
}

export function validateVideoReference(
  candidate: unknown,
): ProviderExecutionValidationResult {
  if (!isRecord(candidate)) {
    return failure([
      {
        code: 'INVALID_VIDEO_REFERENCE',
        message: 'Provider output must be a VideoReference object',
      },
    ])
  }

  const presentRequiredFields = [
    candidate.referenceId,
    candidate.sourceType,
    candidate.location,
  ].filter((value) => value !== undefined).length

  if (presentRequiredFields > 0 && presentRequiredFields < 3) {
    return failure([
      {
        code: 'PARTIAL_VIDEO_REFERENCE',
        message: 'Provider output cannot expose a partial VideoReference',
      },
    ])
  }

  if (!hasOnlyKeys(candidate, videoReferenceKeys)) {
    return failure([
      {
        code: 'INVALID_VIDEO_REFERENCE',
        message: 'VideoReference contains fields outside the boundary contract',
      },
    ])
  }

  const forbiddenIssue = findForbiddenField(candidate, '')
  if (forbiddenIssue !== undefined) {
    return failure([forbiddenIssue])
  }

  if (
    !isNonEmptyString(candidate.referenceId) ||
    candidate.sourceType !== 'provider-output' ||
    !isNonEmptyString(candidate.location) ||
    (candidate.metadata !== undefined &&
      (!isRecord(candidate.metadata) ||
        !Object.values(candidate.metadata).every(isProviderMetadataValue)))
  ) {
    return failure([
      {
        code: 'INVALID_VIDEO_REFERENCE',
        message:
          'VideoReference requires referenceId, provider-output sourceType, location, and JSON-safe optional metadata',
      },
    ])
  }

  return Object.freeze({ valid: true })
}

export function validateProviderExecution(
  candidate: unknown,
): ProviderExecutionValidationResult {
  if (!isRecord(candidate) || typeof candidate.ok !== 'boolean') {
    return failure([
      {
        code: 'INVALID_VIDEO_REFERENCE',
        message: 'ProviderExecutionResult must be a success or failure result',
      },
    ])
  }

  if (candidate.ok === true) {
    if (
      !hasOnlyKeys(candidate, ['ok', 'reference']) ||
      !('reference' in candidate)
    ) {
      return failure([
        {
          code: 'PARTIAL_VIDEO_REFERENCE',
          message: 'Successful ProviderExecutionResult requires one complete reference',
        },
      ])
    }
    return validateVideoReference(candidate.reference)
  }

  if (
    !hasOnlyKeys(candidate, ['ok', 'issues']) ||
    !Array.isArray(candidate.issues) ||
    candidate.issues.length === 0 ||
    candidate.issues.some(
      (issue) =>
        !isRecord(issue) ||
        !isNonEmptyString(issue.code) ||
        !isNonEmptyString(issue.message) ||
        ('reference' in issue),
    )
  ) {
    return failure([
      {
        code: 'INVALID_VIDEO_REFERENCE',
        message:
          'Failed ProviderExecutionResult requires non-empty issues and cannot expose a reference',
      },
    ])
  }

  return Object.freeze({ valid: true })
}

export function isGenerationRequest(
  candidate: unknown,
): candidate is GenerationRequest {
  return validateGenerationRequest(candidate).valid
}

export function isVideoReference(candidate: unknown): candidate is VideoReference {
  return validateVideoReference(candidate).valid
}

export function isProviderExecutionResult(
  candidate: unknown,
): candidate is ProviderExecutionResult {
  return validateProviderExecution(candidate).valid
}
