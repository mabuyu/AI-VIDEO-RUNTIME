import type { ProductionJob, ProductionJobStatus } from '../jobs'
import { isAuthorizedProductionJobSnapshot } from '../jobs/productionJobAuthority'
import { applicationFailure, applicationSuccess } from './applicationResult'
import type {
  ProductDeliveryProjection,
  ProductionStatusProjection,
} from './contracts'

const JOB_KEYS = Object.freeze([
  'jobId',
  'planId',
  'requestId',
  'status',
  'version',
  'attemptCount',
  'maxAttempts',
  'currentAttemptId',
  'lease',
  'createdAt',
  'updatedAt',
])
const JOB_STATUSES: readonly ProductionJobStatus[] = Object.freeze([
  'CREATED',
  'SCHEDULED',
  'CLAIMED',
  'RUNNING',
  'RETRY_WAIT',
  'RECOVERY_PENDING',
  'COMPLETED',
  'FAILED',
])

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function isProjectionJob(value: unknown): value is ProductionJob {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !Object.isFrozen(value)
  ) {
    return false
  }
  if (!isAuthorizedProductionJobSnapshot(value)) return false
  const job = value as unknown as Record<string, unknown>
  const keys = Object.keys(job)
  return (
    keys.length === JOB_KEYS.length &&
    keys.every((key) => JOB_KEYS.includes(key)) &&
    isBoundaryString(job.jobId) &&
    isBoundaryString(job.planId) &&
    isBoundaryString(job.requestId) &&
    JOB_STATUSES.includes(job.status as ProductionJobStatus) &&
    Number.isSafeInteger(job.attemptCount) &&
    (job.attemptCount as number) >= 0 &&
    isBoundaryString(job.updatedAt) &&
    Number.isFinite(Date.parse(job.updatedAt))
  )
}

export function createProductionStatusProjection(): ProductionStatusProjection {
  const projection: ProductionStatusProjection = {
    project(input) {
      if (
        typeof input !== 'object' ||
        input === null ||
        !isBoundaryString(input.projectId) ||
        !isBoundaryString(input.requestId) ||
        !isBoundaryString(input.planId) ||
        !isBoundaryString(input.jobId) ||
        !isProjectionJob(input.job)
      ) {
        return applicationFailure(
          'INVALID_REQUEST',
          'Production status projection input is invalid',
        )
      }
      if (
        input.requestId !== input.job.requestId ||
        input.planId !== input.job.planId ||
        input.jobId !== input.job.jobId
      ) {
        return applicationFailure(
          'CONFLICT',
          'Production status correlation does not match the authoritative Job',
        )
      }
      return applicationSuccess(
        Object.freeze({
          projectId: input.projectId,
          requestId: input.job.requestId,
          planId: input.job.planId,
          jobId: input.job.jobId,
          status: input.job.status,
          attemptCount: input.job.attemptCount,
          updatedAt: input.job.updatedAt,
        }),
      )
    },
  }
  return Object.freeze(projection)
}

export function createProductDeliveryProjection(): ProductDeliveryProjection {
  const projection: ProductDeliveryProjection = {
    project(input) {
      if (
        typeof input !== 'object' ||
        input === null ||
        !isBoundaryString(input.projectId) ||
        !isBoundaryString(input.requestId) ||
        !isBoundaryString(input.jobId) ||
        !isProjectionJob(input.job) ||
        typeof input.delivery !== 'object' ||
        input.delivery === null ||
        !Object.isFrozen(input.delivery) ||
        typeof input.delivery.reference !== 'object' ||
        input.delivery.reference === null ||
        !Object.isFrozen(input.delivery.reference)
      ) {
        return applicationFailure(
          'INVALID_REQUEST',
          'Product delivery projection input is invalid',
        )
      }
      const reference = input.delivery.reference
      if (
        input.job.status !== 'COMPLETED' ||
        input.projectId !== input.delivery.projectId ||
        input.requestId !== input.delivery.requestId ||
        input.jobId !== input.delivery.jobId ||
        input.requestId !== input.job.requestId ||
        input.jobId !== input.job.jobId ||
        !isBoundaryString(reference.artifactId) ||
        reference.mediaType !== 'video' ||
        !isBoundaryString(reference.format) ||
        !isBoundaryString(reference.resourceReference)
      ) {
        return applicationFailure(
          'CONFLICT',
          'READY delivery correlation does not match a completed Production Job',
        )
      }
      return applicationSuccess(
        Object.freeze({
          projectId: input.projectId,
          requestId: input.requestId,
          jobId: input.jobId,
          artifactId: reference.artifactId,
          mediaType: reference.mediaType,
          format: reference.format,
          resourceReference: reference.resourceReference,
        }),
      )
    },
  }
  return Object.freeze(projection)
}
