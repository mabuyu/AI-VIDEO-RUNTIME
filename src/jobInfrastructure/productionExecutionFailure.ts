import type {
  CreateProductionExecutionFailureEvidenceInput,
  ProductionExecutionFailureEvidence,
} from './contracts'

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

export function createProductionExecutionFailureEvidence(
  input: CreateProductionExecutionFailureEvidenceInput,
): ProductionExecutionFailureEvidence {
  const { executionResult } = input
  if (
    executionResult.status !== 'FAILED' ||
    !isBoundaryString(executionResult.executionId) ||
    !isBoundaryString(executionResult.planId) ||
    !isBoundaryString(input.code) ||
    !isBoundaryString(input.message) ||
    (input.classification !== 'RETRYABLE' &&
      input.classification !== 'NON_RETRYABLE') ||
    !isBoundaryString(input.occurredAt) ||
    !Number.isFinite(Date.parse(input.occurredAt))
  ) {
    throw new TypeError('Execution failure evidence is invalid')
  }

  return Object.freeze({
    executionId: executionResult.executionId,
    planId: executionResult.planId,
    code: input.code,
    message: input.message,
    classification: input.classification,
    occurredAt: input.occurredAt,
  })
}
