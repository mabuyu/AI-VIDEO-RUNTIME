import type {
  ProductionJob,
  ProductionJobIssue,
  ProductionJobStatus,
  ProductionJobTransitionResult,
} from '../types/productionJob'
import { validateProductionJobTransition } from '../validation/validateProductionJobTransition'

function transitionFailure(
  issues: readonly ProductionJobIssue[],
): ProductionJobTransitionResult {
  return Object.freeze({
    ok: false,
    issues: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))),
  })
}

export function transitionProductionJob(
  job: ProductionJob,
  targetStatus: ProductionJobStatus,
  updatedAt: string,
): ProductionJobTransitionResult {
  const validation = validateProductionJobTransition(job.status, targetStatus)

  if (!validation.valid) {
    return transitionFailure(validation.issues)
  }

  const updatedAtMilliseconds = Date.parse(updatedAt)
  if (!Number.isFinite(updatedAtMilliseconds)) {
    return transitionFailure([
      {
        code: 'INVALID_TIMESTAMP',
        message: 'ProductionJob transition requires a valid updatedAt timestamp',
      },
    ])
  }

  const currentUpdatedAtMilliseconds = Date.parse(job.updatedAt)
  if (!Number.isFinite(currentUpdatedAtMilliseconds)) {
    return transitionFailure([
      {
        code: 'INVALID_TIMESTAMP',
        message: 'ProductionJob contains an invalid updatedAt timestamp',
      },
    ])
  }

  if (updatedAtMilliseconds < currentUpdatedAtMilliseconds) {
    return transitionFailure([
      {
        code: 'TIMESTAMP_REGRESSION',
        message: 'ProductionJob updatedAt cannot move backward',
      },
    ])
  }

  const transitionedJob: ProductionJob = Object.freeze({
    jobId: job.jobId,
    commandId: job.commandId,
    status: targetStatus,
    attemptsSummary: Object.freeze([]),
    createdAt: job.createdAt,
    updatedAt,
  })

  return Object.freeze({
    ok: true,
    job: transitionedJob,
  })
}
