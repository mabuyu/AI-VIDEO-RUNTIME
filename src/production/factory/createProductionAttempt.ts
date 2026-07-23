import type {
  ProductionAttempt,
  ProductionAttemptCreationResult,
  ProductionAttemptIssue,
} from '../types/productionAttempt'

export interface CreateProductionAttemptInput {
  readonly attemptId: string
  readonly jobId: string
  readonly provider: string
  readonly providerRequestId?: string
  readonly generationId?: string
  readonly status?: 'CREATED'
  readonly createdAt: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  )
}

function freezeIssues(
  issues: readonly ProductionAttemptIssue[],
): readonly ProductionAttemptIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

export function createProductionAttempt(
  input: CreateProductionAttemptInput,
): ProductionAttemptCreationResult {
  const issues: ProductionAttemptIssue[] = []

  if (!isNonEmptyString(input.attemptId)) {
    issues.push({
      code: 'INVALID_ATTEMPT_ID',
      message: 'ProductionAttempt requires a non-empty attemptId',
    })
  }

  if (!isNonEmptyString(input.jobId)) {
    issues.push({
      code: 'INVALID_JOB_ID',
      message: 'ProductionAttempt requires a non-empty jobId',
    })
  }

  if (!isNonEmptyString(input.provider)) {
    issues.push({
      code: 'INVALID_PROVIDER',
      message: 'ProductionAttempt requires a non-empty provider',
    })
  }

  if (
    input.providerRequestId !== undefined &&
    !isNonEmptyString(input.providerRequestId)
  ) {
    issues.push({
      code: 'INVALID_PROVIDER_REQUEST_ID',
      message: 'ProductionAttempt providerRequestId must be a non-empty string',
    })
  }

  if (
    input.generationId !== undefined &&
    !isNonEmptyString(input.generationId)
  ) {
    issues.push({
      code: 'INVALID_GENERATION_ID',
      message: 'ProductionAttempt generationId must be a non-empty string',
    })
  }

  if (input.status !== undefined && input.status !== 'CREATED') {
    issues.push({
      code: 'INVALID_INITIAL_STATUS',
      message: 'ProductionAttempt creation status must be CREATED',
    })
  }

  if (!isValidTimestamp(input.createdAt)) {
    issues.push({
      code: 'INVALID_TIMESTAMP',
      message: 'ProductionAttempt requires a valid createdAt timestamp',
    })
  }

  if (issues.length > 0) {
    return Object.freeze({
      ok: false,
      issues: freezeIssues(issues),
    })
  }

  const attempt: ProductionAttempt = Object.freeze({
    attemptId: input.attemptId,
    jobId: input.jobId,
    provider: input.provider,
    ...(input.providerRequestId === undefined
      ? {}
      : { providerRequestId: input.providerRequestId }),
    ...(input.generationId === undefined
      ? {}
      : { generationId: input.generationId }),
    status: 'CREATED',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  })

  return Object.freeze({
    ok: true,
    attempt,
  })
}
