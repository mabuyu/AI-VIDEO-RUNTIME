import type {
  ProductionAttempt,
  ProductionAttemptErrorInformation,
  ProductionAttemptIssue,
  ProductionAttemptStatus,
  ProductionAttemptTransitionResult,
  ProductionAttemptTransitionUpdate,
} from '../types/productionAttempt'
import { validateProductionAttemptTransition } from '../validation/validateProductionAttemptTransition'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function freezeIssues(
  issues: readonly ProductionAttemptIssue[],
): readonly ProductionAttemptIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function transitionFailure(
  issues: readonly ProductionAttemptIssue[],
): ProductionAttemptTransitionResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

function freezeErrorInformation(
  errorInformation: ProductionAttemptErrorInformation,
): ProductionAttemptErrorInformation {
  return Object.freeze({
    code: errorInformation.code,
    message: errorInformation.message,
    ...(errorInformation.retryable === undefined
      ? {}
      : { retryable: errorInformation.retryable }),
  })
}

function validateUpdate(
  targetStatus: ProductionAttemptStatus,
  update: ProductionAttemptTransitionUpdate,
): readonly ProductionAttemptIssue[] {
  const issues: ProductionAttemptIssue[] = []

  if (
    update.providerRequestId !== undefined &&
    !isNonEmptyString(update.providerRequestId)
  ) {
    issues.push({
      code: 'INVALID_PROVIDER_REQUEST_ID',
      message: 'ProductionAttempt providerRequestId must be a non-empty string',
    })
  }

  if (
    update.generationId !== undefined &&
    !isNonEmptyString(update.generationId)
  ) {
    issues.push({
      code: 'INVALID_GENERATION_ID',
      message: 'ProductionAttempt generationId must be a non-empty string',
    })
  }

  if (update.errorInformation !== undefined) {
    const errorInformation = update.errorInformation
    const isObject =
      typeof errorInformation === 'object' &&
      errorInformation !== null &&
      !Array.isArray(errorInformation)

    if (
      targetStatus !== 'FAILED' ||
      !isObject ||
      !isNonEmptyString(errorInformation.code) ||
      !isNonEmptyString(errorInformation.message) ||
      (errorInformation.retryable !== undefined &&
        typeof errorInformation.retryable !== 'boolean')
    ) {
      issues.push({
        code: 'INVALID_ERROR_INFORMATION',
        message:
          'ProductionAttempt errorInformation must be sanitized and may only be recorded on FAILED',
      })
    }
  }

  return issues
}

export function transitionProductionAttempt(
  attempt: ProductionAttempt,
  targetStatus: ProductionAttemptStatus,
  updatedAt: string,
  update: ProductionAttemptTransitionUpdate = {},
): ProductionAttemptTransitionResult {
  const validation = validateProductionAttemptTransition(
    attempt.status,
    targetStatus,
  )

  if (!validation.valid) {
    return transitionFailure(validation.issues)
  }

  const issues: ProductionAttemptIssue[] = [
    ...validateUpdate(targetStatus, update),
  ]

  const updatedAtMilliseconds = Date.parse(updatedAt)
  if (!Number.isFinite(updatedAtMilliseconds)) {
    issues.push({
      code: 'INVALID_TIMESTAMP',
      message: 'ProductionAttempt transition requires a valid updatedAt timestamp',
    })
  }

  const currentUpdatedAtMilliseconds = Date.parse(attempt.updatedAt)
  if (!Number.isFinite(currentUpdatedAtMilliseconds)) {
    issues.push({
      code: 'INVALID_TIMESTAMP',
      message: 'ProductionAttempt contains an invalid updatedAt timestamp',
    })
  } else if (
    Number.isFinite(updatedAtMilliseconds) &&
    updatedAtMilliseconds < currentUpdatedAtMilliseconds
  ) {
    issues.push({
      code: 'TIMESTAMP_REGRESSION',
      message: 'ProductionAttempt updatedAt cannot move backward',
    })
  }

  if (issues.length > 0) {
    return transitionFailure(issues)
  }

  const providerRequestId =
    update.providerRequestId ?? attempt.providerRequestId
  const generationId = update.generationId ?? attempt.generationId
  const errorInformation = update.errorInformation

  const transitionedAttempt: ProductionAttempt = Object.freeze({
    attemptId: attempt.attemptId,
    jobId: attempt.jobId,
    provider: attempt.provider,
    ...(providerRequestId === undefined ? {} : { providerRequestId }),
    ...(generationId === undefined ? {} : { generationId }),
    status: targetStatus,
    ...(targetStatus === 'FAILED' && errorInformation !== undefined
      ? { errorInformation: freezeErrorInformation(errorInformation) }
      : {}),
    createdAt: attempt.createdAt,
    updatedAt,
  })

  return Object.freeze({
    ok: true,
    attempt: transitionedAttempt,
  })
}
