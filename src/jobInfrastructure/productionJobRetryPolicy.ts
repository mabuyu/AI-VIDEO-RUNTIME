import type {
  FixedProductionJobRetryPolicyOptions,
  ProductionJobRetryDecision,
  ProductionJobRetryPolicy,
  ProductionJobRetryPolicyInput,
} from './contracts'

function validateCorrelation(input: ProductionJobRetryPolicyInput): void {
  const { job, failure, attempt } = input
  if (
    job.status !== 'RUNNING' ||
    job.currentAttemptId === null ||
    attempt.outcome !== 'FAILED' ||
    attempt.attemptId !== job.currentAttemptId ||
    attempt.jobId !== job.jobId ||
    attempt.attemptNumber !== job.attemptCount ||
    attempt.executionId !== failure.executionId ||
    attempt.failureClassification !== failure.classification ||
    failure.planId !== job.planId
  ) {
    throw new TypeError('Retry decision input correlation is invalid')
  }
}

export function createFixedProductionJobRetryPolicy(
  options: FixedProductionJobRetryPolicyOptions,
): ProductionJobRetryPolicy {
  if (
    !Number.isSafeInteger(options.delayMilliseconds) ||
    options.delayMilliseconds < 0
  ) {
    throw new TypeError('Retry delayMilliseconds must be a safe integer')
  }

  const delayMilliseconds = options.delayMilliseconds
  return Object.freeze({
    decide(input: ProductionJobRetryPolicyInput): ProductionJobRetryDecision {
      validateCorrelation(input)

      if (input.failure.classification === 'NON_RETRYABLE') {
        return Object.freeze({
          decision: 'FAIL',
          reason: 'NON_RETRYABLE_FAILURE',
          nextAvailableAt: null,
        })
      }

      if (input.job.attemptCount >= input.job.maxAttempts) {
        return Object.freeze({
          decision: 'FAIL',
          reason: 'ATTEMPT_BUDGET_EXHAUSTED',
          nextAvailableAt: null,
        })
      }

      const availableAtMilliseconds =
        Date.parse(input.failure.occurredAt) + delayMilliseconds
      if (!Number.isFinite(availableAtMilliseconds)) {
        throw new TypeError('Retry nextAvailableAt is outside timestamp range')
      }

      return Object.freeze({
        decision: 'RETRY',
        reason: 'RETRYABLE_FAILURE',
        nextAvailableAt: new Date(availableAtMilliseconds).toISOString(),
      })
    },
  })
}
