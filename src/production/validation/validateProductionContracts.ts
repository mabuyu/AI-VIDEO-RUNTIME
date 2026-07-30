import type {
  GenerationResult,
  GenerationTask,
  ProductionPlan,
  ProductionRequest,
  ProductionValidationIssue,
  ProductionValidationResult,
} from '../contracts'

const GENERATION_STATUSES = new Set([
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
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
  issues: readonly ProductionValidationIssue[],
): readonly ProductionValidationIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ProductionValidationIssue[],
): ProductionValidationResult {
  return Object.freeze({
    valid: false,
    issues: freezeIssues(issues),
  })
}

function validateOutputSpecification(
  candidate: unknown,
  path: string,
  code:
    | 'INVALID_PRODUCTION_REQUEST'
    | 'INVALID_GENERATION_TASK'
    | 'INVALID_GENERATION_RESULT',
): ProductionValidationIssue | undefined {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, ['mediaType', 'format']) ||
    candidate.mediaType !== 'video' ||
    !isNonEmptyString(candidate.format)
  ) {
    return {
      code,
      message:
        'Output specification requires video mediaType and a non-empty format',
      path,
    }
  }

  return undefined
}

function collectGenerationTaskIssues(
  candidate: unknown,
  path = '',
): ProductionValidationIssue[] {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, [
      'taskId',
      'requestId',
      'providerId',
      'generationIntent',
      'outputSpecification',
    ])
  ) {
    return [
      {
        code: 'INVALID_GENERATION_TASK',
        message: 'GenerationTask contains fields outside its boundary contract',
        ...(path.length === 0 ? {} : { path }),
      },
    ]
  }

  const issues: ProductionValidationIssue[] = []
  const fields = [
    ['taskId', candidate.taskId],
    ['requestId', candidate.requestId],
    ['providerId', candidate.providerId],
    ['generationIntent', candidate.generationIntent],
  ] as const

  for (const [field, value] of fields) {
    if (!isNonEmptyString(value)) {
      issues.push({
        code: 'INVALID_GENERATION_TASK',
        message: `GenerationTask requires a non-empty ${field}`,
        path: path.length === 0 ? field : `${path}.${field}`,
      })
    }
  }

  const outputIssue = validateOutputSpecification(
    candidate.outputSpecification,
    path.length === 0
      ? 'outputSpecification'
      : `${path}.outputSpecification`,
    'INVALID_GENERATION_TASK',
  )
  if (outputIssue !== undefined) {
    issues.push(outputIssue)
  }

  return issues
}

export function validateProductionRequest(
  candidate: unknown,
): ProductionValidationResult {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, [
      'requestId',
      'generationIntent',
      'outputSpecification',
    ])
  ) {
    return failure([
      {
        code: 'INVALID_PRODUCTION_REQUEST',
        message:
          'ProductionRequest contains fields outside its boundary contract',
      },
    ])
  }

  const issues: ProductionValidationIssue[] = []

  if (!isNonEmptyString(candidate.requestId)) {
    issues.push({
      code: 'INVALID_PRODUCTION_REQUEST',
      message: 'ProductionRequest requires a non-empty requestId',
      path: 'requestId',
    })
  }

  if (!isNonEmptyString(candidate.generationIntent)) {
    issues.push({
      code: 'INVALID_PRODUCTION_REQUEST',
      message: 'ProductionRequest requires a non-empty generationIntent',
      path: 'generationIntent',
    })
  }

  const outputIssue = validateOutputSpecification(
    candidate.outputSpecification,
    'outputSpecification',
    'INVALID_PRODUCTION_REQUEST',
  )
  if (outputIssue !== undefined) {
    issues.push(outputIssue)
  }

  return issues.length === 0
    ? Object.freeze({ valid: true })
    : failure(issues)
}

export function validateGenerationTask(
  candidate: unknown,
): ProductionValidationResult {
  const issues = collectGenerationTaskIssues(candidate)
  return issues.length === 0
    ? Object.freeze({ valid: true })
    : failure(issues)
}

export function validateProductionPlan(
  candidate: unknown,
): ProductionValidationResult {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, ['planId', 'requestId', 'tasks'])
  ) {
    return failure([
      {
        code: 'INVALID_PRODUCTION_PLAN',
        message: 'ProductionPlan contains fields outside its boundary contract',
      },
    ])
  }

  const issues: ProductionValidationIssue[] = []

  if (!isNonEmptyString(candidate.planId)) {
    issues.push({
      code: 'INVALID_PRODUCTION_PLAN',
      message: 'ProductionPlan requires a non-empty planId',
      path: 'planId',
    })
  }

  if (!isNonEmptyString(candidate.requestId)) {
    issues.push({
      code: 'INVALID_PRODUCTION_PLAN',
      message: 'ProductionPlan requires a non-empty requestId',
      path: 'requestId',
    })
  }

  if (!Array.isArray(candidate.tasks) || candidate.tasks.length === 0) {
    issues.push({
      code: 'INVALID_PRODUCTION_PLAN',
      message: 'ProductionPlan requires at least one GenerationTask',
      path: 'tasks',
    })
  } else {
    const taskIds = new Set<string>()

    candidate.tasks.forEach((task, index) => {
      issues.push(...collectGenerationTaskIssues(task, `tasks[${index}]`))

      if (!isRecord(task)) {
        return
      }

      if (
        isNonEmptyString(task.requestId) &&
        isNonEmptyString(candidate.requestId) &&
        task.requestId !== candidate.requestId
      ) {
        issues.push({
          code: 'REQUEST_ID_MISMATCH',
          message: 'Every GenerationTask must belong to the ProductionPlan request',
          path: `tasks[${index}].requestId`,
        })
      }

      if (isNonEmptyString(task.taskId)) {
        if (taskIds.has(task.taskId)) {
          issues.push({
            code: 'DUPLICATE_TASK_ID',
            message: 'ProductionPlan taskId values must be unique',
            path: `tasks[${index}].taskId`,
          })
        }
        taskIds.add(task.taskId)
      }
    })
  }

  return issues.length === 0
    ? Object.freeze({ valid: true })
    : failure(issues)
}

export function validateGenerationResult(
  candidate: unknown,
): ProductionValidationResult {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, [
      'taskId',
      'providerId',
      'providerTaskId',
      'status',
      'output',
      'issues',
    ])
  ) {
    return failure([
      {
        code: 'INVALID_GENERATION_RESULT',
        message: 'GenerationResult contains fields outside its boundary contract',
      },
    ])
  }

  const issues: ProductionValidationIssue[] = []

  if (!isNonEmptyString(candidate.taskId)) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: 'GenerationResult requires a non-empty taskId',
      path: 'taskId',
    })
  }

  if (!isNonEmptyString(candidate.providerId)) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: 'GenerationResult requires a non-empty providerId',
      path: 'providerId',
    })
  }

  if (
    typeof candidate.status !== 'string' ||
    !GENERATION_STATUSES.has(candidate.status)
  ) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: 'GenerationResult has an unsupported status',
      path: 'status',
    })
  }

  if (
    candidate.providerTaskId !== null &&
    !isNonEmptyString(candidate.providerTaskId)
  ) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: 'providerTaskId must be null or a non-empty string',
      path: 'providerTaskId',
    })
  }

  if (!Array.isArray(candidate.issues)) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: 'GenerationResult issues must be an array',
      path: 'issues',
    })
  } else if (
    candidate.issues.some(
      (issue) =>
        !isRecord(issue) ||
        !hasOnlyKeys(issue, ['code', 'message', 'retryable']) ||
        !isNonEmptyString(issue.code) ||
        !isNonEmptyString(issue.message) ||
        (issue.retryable !== undefined &&
          typeof issue.retryable !== 'boolean'),
    )
  ) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: 'GenerationResult contains an invalid issue',
      path: 'issues',
    })
  }

  const requiresProviderTaskId =
    candidate.status === 'QUEUED' ||
    candidate.status === 'RUNNING' ||
    candidate.status === 'SUCCEEDED' ||
    candidate.status === 'CANCELLED'

  if (requiresProviderTaskId && !isNonEmptyString(candidate.providerTaskId)) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: `${String(candidate.status)} requires a providerTaskId`,
      path: 'providerTaskId',
    })
  }

  if (candidate.status === 'SUCCEEDED') {
    if (!isRecord(candidate.output)) {
      issues.push({
        code: 'INVALID_GENERATION_RESULT',
        message: 'SUCCEEDED GenerationResult requires a complete output',
        path: 'output',
      })
    } else {
      const outputIssue = validateOutputSpecification(
        {
          mediaType: candidate.output.mediaType,
          format: candidate.output.format,
        },
        'output',
        'INVALID_GENERATION_RESULT',
      )
      if (
        outputIssue !== undefined ||
        !hasOnlyKeys(candidate.output, ['mediaType', 'format', 'reference']) ||
        !isNonEmptyString(candidate.output.reference)
      ) {
        issues.push({
          code: 'INVALID_GENERATION_RESULT',
          message:
            'Generation output requires video mediaType, format, and provider reference',
          path: 'output',
        })
      }
    }

    if (Array.isArray(candidate.issues) && candidate.issues.length > 0) {
      issues.push({
        code: 'INVALID_GENERATION_RESULT',
        message: 'SUCCEEDED GenerationResult cannot contain issues',
        path: 'issues',
      })
    }
  } else if (candidate.output !== null) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: 'Only a SUCCEEDED GenerationResult may contain output',
      path: 'output',
    })
  }

  if (
    candidate.status === 'FAILED' &&
    Array.isArray(candidate.issues) &&
    candidate.issues.length === 0
  ) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT',
      message: 'FAILED GenerationResult requires at least one issue',
      path: 'issues',
    })
  }

  return issues.length === 0
    ? Object.freeze({ valid: true })
    : failure(issues)
}

export function isProductionRequest(
  candidate: unknown,
): candidate is ProductionRequest {
  return validateProductionRequest(candidate).valid
}

export function isGenerationTask(
  candidate: unknown,
): candidate is GenerationTask {
  return validateGenerationTask(candidate).valid
}

export function isProductionPlan(candidate: unknown): candidate is ProductionPlan {
  return validateProductionPlan(candidate).valid
}

export function isGenerationResult(
  candidate: unknown,
): candidate is GenerationResult {
  return validateGenerationResult(candidate).valid
}
