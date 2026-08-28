import type { ProductionJob } from '../jobs'
import type { ProductionJobStore } from './contracts'

const JOB_KEYS: readonly string[] = Object.freeze([
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
const LEASE_KEYS: readonly string[] = Object.freeze([
  'leaseId',
  'workerId',
  'expiresAt',
])

function hasExactStringKeys(
  value: object,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Reflect.ownKeys(value)
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key) => typeof key === 'string' && expectedKeys.includes(key),
    )
  )
}

function isStorableJobSnapshot(value: unknown): value is ProductionJob {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      !Object.isFrozen(value) ||
      !hasExactStringKeys(value, JOB_KEYS)
    ) {
      return false
    }

    const job = value as Record<string, unknown>
    if (
      typeof job.jobId !== 'string' ||
      job.jobId.length === 0 ||
      typeof job.planId !== 'string' ||
      job.planId.length === 0 ||
      typeof job.requestId !== 'string' ||
      job.requestId.length === 0 ||
      !Number.isSafeInteger(job.version) ||
      (job.version as number) < 0
    ) {
      return false
    }

    if (job.lease === null) return true
    return (
      typeof job.lease === 'object' &&
      !Array.isArray(job.lease) &&
      Object.isFrozen(job.lease) &&
      hasExactStringKeys(job.lease, LEASE_KEYS)
    )
  } catch {
    return false
  }
}

function keepsStableIdentity(
  current: ProductionJob,
  replacement: ProductionJob,
): boolean {
  return (
    replacement.jobId === current.jobId &&
    replacement.planId === current.planId &&
    replacement.requestId === current.requestId &&
    replacement.maxAttempts === current.maxAttempts &&
    replacement.createdAt === current.createdAt
  )
}

/**
 * Process-local snapshot holder. It preserves object identity because Job trust
 * belongs exclusively to ProductionJobStateAuthority.
 */
export function createInMemoryProductionJobStore(
  initialJobs: readonly ProductionJob[] = [],
): ProductionJobStore {
  const jobs = new Map<string, ProductionJob>()

  for (const job of initialJobs) {
    if (!isStorableJobSnapshot(job)) {
      throw new TypeError(
        'ProductionJobStore requires an immutable Job snapshot',
      )
    }
    if (jobs.has(job.jobId)) {
      throw new TypeError(
        `ProductionJobStore received duplicate jobId ${job.jobId}`,
      )
    }
    jobs.set(job.jobId, job)
  }

  return Object.freeze({
    async getById(jobId: string): Promise<ProductionJob | null> {
      return jobs.get(jobId) ?? null
    },

    async replace(
      job: ProductionJob,
      expectedVersion: number,
    ): Promise<boolean> {
      if (
        !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 0 ||
        !isStorableJobSnapshot(job)
      ) {
        return false
      }

      const current = jobs.get(job.jobId)
      if (
        current === undefined ||
        current.version !== expectedVersion ||
        job.version !== expectedVersion + 1 ||
        !keepsStableIdentity(current, job)
      ) {
        return false
      }

      jobs.set(job.jobId, job)
      return true
    },
  })
}
