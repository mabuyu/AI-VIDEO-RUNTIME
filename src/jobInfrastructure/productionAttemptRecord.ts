import {
  isAuthorizedProductionJobSnapshot,
} from '../jobs/productionJobAuthority'
import type {
  CreateProductionAttemptRecordInput,
  ProductionAttemptOutcome,
  ProductionAttemptRecord,
  ProductionFailureClassification,
} from './contracts'

const OUTCOMES: readonly ProductionAttemptOutcome[] = Object.freeze([
  'RUNNING',
  'COMPLETED',
  'FAILED',
])
const CLASSIFICATIONS: readonly ProductionFailureClassification[] =
  Object.freeze(['RETRYABLE', 'NON_RETRYABLE'])

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function isTimestamp(value: unknown): value is string {
  return isBoundaryString(value) && Number.isFinite(Date.parse(value))
}

export function createProductionAttemptRecord(
  input: CreateProductionAttemptRecordInput,
): ProductionAttemptRecord {
  const { job } = input
  if (!isAuthorizedProductionJobSnapshot(job)) {
    throw new TypeError('ProductionAttemptRecord requires an authorized Job')
  }
  if (job.currentAttemptId === null || job.attemptCount <= 0) {
    throw new TypeError('ProductionAttemptRecord requires a claimed attempt')
  }
  if (
    !isBoundaryString(input.executionId) ||
    !OUTCOMES.includes(input.outcome) ||
    !isTimestamp(input.startedAt)
  ) {
    throw new TypeError('ProductionAttemptRecord input is invalid')
  }

  const isTerminal = input.outcome !== 'RUNNING'
  if (
    (isTerminal && !isTimestamp(input.finishedAt)) ||
    (!isTerminal && input.finishedAt !== null) ||
    (isTimestamp(input.finishedAt) &&
      Date.parse(input.finishedAt) < Date.parse(input.startedAt))
  ) {
    throw new TypeError('ProductionAttemptRecord timestamps are invalid')
  }

  if (
    (input.outcome === 'FAILED' &&
      (input.failureClassification === null ||
        !CLASSIFICATIONS.includes(input.failureClassification))) ||
    (input.outcome !== 'FAILED' && input.failureClassification !== null)
  ) {
    throw new TypeError(
      'ProductionAttemptRecord failure classification is invalid',
    )
  }

  return Object.freeze({
    attemptId: job.currentAttemptId,
    jobId: job.jobId,
    attemptNumber: job.attemptCount,
    executionId: input.executionId,
    outcome: input.outcome,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    failureClassification: input.failureClassification,
  })
}
