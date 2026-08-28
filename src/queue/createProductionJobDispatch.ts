import type { ProductionJob } from '../jobs'
import type { ProductionJobDispatch } from './contracts'
import { materializeProductionJobDispatch } from './productionJobDispatchSnapshot'

export function createProductionJobDispatch(
  job: ProductionJob,
  availableAt: string,
): ProductionJobDispatch {
  let status: unknown
  let jobId: unknown
  let expectedVersion: unknown

  try {
    if (!Object.isFrozen(job)) {
      throw new TypeError(
        'ProductionJob dispatch requires an immutable Job snapshot',
      )
    }
    status = job.status
    jobId = job.jobId
    expectedVersion = job.version
  } catch {
    throw new TypeError(
      'ProductionJob dispatch requires a readable immutable Job snapshot',
    )
  }

  if (status !== 'SCHEDULED') {
    throw new TypeError(
      'ProductionJob dispatch can only be created for a SCHEDULED Job',
    )
  }

  const dispatch = materializeProductionJobDispatch({
    dispatchId: `production-job-dispatch:${String(jobId)}:${String(expectedVersion)}`,
    jobId,
    expectedVersion,
    availableAt,
  })
  if (dispatch === null) {
    throw new TypeError('ProductionJob dispatch fields are invalid')
  }

  return dispatch
}
