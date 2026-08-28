import type {
  ProductionAttemptId,
  ProductionJob,
  ProductionJobLease,
  ProductionJobStatus,
} from '../jobs'
import {
  createAuthorizedRehydratedProductionJobSnapshot,
  isAuthorizedProductionJobSnapshot,
} from '../jobs/productionJobAuthority'
import type {
  ProductionJobRecord,
  ProductionJobRepository,
} from './contracts'

const RECORD_KEYS: readonly string[] = Object.freeze([
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
const STATUSES: readonly ProductionJobStatus[] = Object.freeze([
  'CREATED',
  'SCHEDULED',
  'CLAIMED',
  'RUNNING',
  'RETRY_WAIT',
  'RECOVERY_PENDING',
  'COMPLETED',
  'FAILED',
])
const TRUSTED_REHYDRATION_ACCESS: object = Object.freeze({})

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactDataProperties(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Reflect.ownKeys(value)
  return (
    keys.length === expectedKeys.length &&
    keys.every(
      (key) => typeof key === 'string' && expectedKeys.includes(key),
    ) &&
    expectedKeys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return (
        descriptor !== undefined &&
        descriptor.enumerable === true &&
        'value' in descriptor
      )
    })
  )
}

function isBoundaryString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
    })
  )
}

function isTimestamp(value: unknown): value is string {
  return isBoundaryString(value) && Number.isFinite(Date.parse(value))
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function isStatus(value: unknown): value is ProductionJobStatus {
  return STATUSES.some((status) => status === value)
}

function isLease(value: unknown, updatedAt: string): value is ProductionJobLease {
  return (
    isPlainRecord(value) &&
    hasExactDataProperties(value, LEASE_KEYS) &&
    isBoundaryString(value.leaseId) &&
    isBoundaryString(value.workerId) &&
    isTimestamp(value.expiresAt) &&
    Date.parse(value.expiresAt) > Date.parse(updatedAt)
  )
}

export function isProductionJobRecord(
  value: unknown,
): value is ProductionJobRecord {
  if (
    !isPlainRecord(value) ||
    !hasExactDataProperties(value, RECORD_KEYS) ||
    !isBoundaryString(value.jobId) ||
    !isBoundaryString(value.planId) ||
    !isBoundaryString(value.requestId) ||
    !isStatus(value.status) ||
    !isNonNegativeSafeInteger(value.version) ||
    !isNonNegativeSafeInteger(value.attemptCount) ||
    !isPositiveSafeInteger(value.maxAttempts) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return false
  }

  if (
    value.jobId !== `production-job:${value.planId}` ||
    value.attemptCount > value.maxAttempts ||
    value.attemptCount > value.version ||
    Date.parse(value.updatedAt) < Date.parse(value.createdAt)
  ) {
    return false
  }

  if (value.attemptCount === 0) {
    if (value.currentAttemptId !== null) return false
  } else {
    const expectedAttemptId: ProductionAttemptId =
      `production-attempt:${value.jobId}:${value.attemptCount}`
    if (value.currentAttemptId !== expectedAttemptId) return false
  }

  if (
    value.status === 'CREATED' &&
    (value.version !== 0 ||
      value.attemptCount !== 0 ||
      value.currentAttemptId !== null)
  ) {
    return false
  }

  if (
    (value.status === 'RETRY_WAIT' ||
      value.status === 'RECOVERY_PENDING' ||
      value.status === 'COMPLETED' ||
      value.status === 'FAILED') &&
    value.attemptCount === 0
  ) {
    return false
  }

  if (value.status === 'CLAIMED' || value.status === 'RUNNING') {
    return value.attemptCount > 0 && isLease(value.lease, value.updatedAt)
  }

  return value.lease === null
}

function copyLease(lease: ProductionJobLease | null): ProductionJobLease | null {
  return lease === null
    ? null
    : Object.freeze({
        leaseId: lease.leaseId,
        workerId: lease.workerId,
        expiresAt: lease.expiresAt,
      })
}

function copyRecord(
  value: ProductionJob | ProductionJobRecord,
): ProductionJobRecord {
  return Object.freeze({
    jobId: value.jobId,
    planId: value.planId,
    requestId: value.requestId,
    status: value.status,
    version: value.version,
    attemptCount: value.attemptCount,
    maxAttempts: value.maxAttempts,
    currentAttemptId: value.currentAttemptId,
    lease: copyLease(value.lease),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  })
}

function createRecord(job: ProductionJob): ProductionJobRecord | null {
  const value: unknown = job
  if (
    !isPlainRecord(value) ||
    !isAuthorizedProductionJobSnapshot(value)
  ) {
    return null
  }

  const record = copyRecord(job)
  return isProductionJobRecord(record) ? record : null
}

function rehydrateProductionJob(
  record: unknown,
  access: object,
): ProductionJob {
  if (!isProductionJobRecord(record)) {
    throw new TypeError('ProductionJobRepository rejected an invalid record')
  }
  if (access !== TRUSTED_REHYDRATION_ACCESS) {
    throw new TypeError(
      'ProductionJob rehydration requires trusted repository access',
    )
  }

  return createAuthorizedRehydratedProductionJobSnapshot(copyRecord(record))
}

function keepsStableIdentity(
  current: ProductionJobRecord,
  next: ProductionJobRecord,
): boolean {
  return (
    next.jobId === current.jobId &&
    next.planId === current.planId &&
    next.requestId === current.requestId &&
    next.maxAttempts === current.maxAttempts &&
    next.createdAt === current.createdAt
  )
}

/** Map-backed infrastructure reference with record copies and version CAS. */
export function createInMemoryProductionJobRepository(
  initialJobs: readonly ProductionJob[] = [],
): ProductionJobRepository {
  const records = new Map<string, ProductionJobRecord>()

  for (const job of initialJobs) {
    const record = createRecord(job)
    if (record === null) {
      throw new TypeError(
        'ProductionJobRepository requires authorized initial Jobs',
      )
    }
    if (records.has(record.jobId)) {
      throw new TypeError(
        `ProductionJobRepository received duplicate jobId ${record.jobId}`,
      )
    }
    records.set(record.jobId, record)
  }

  async function save(
    job: ProductionJob,
    expectedVersion: number | null,
  ): Promise<boolean> {
    const next = createRecord(job)
    if (next === null) return false

    const current = records.get(next.jobId)
    if (expectedVersion === null) {
      if (current !== undefined || next.version !== 0) return false
      records.set(next.jobId, next)
      return true
    }

    if (
      !isNonNegativeSafeInteger(expectedVersion) ||
      current === undefined ||
      current.version !== expectedVersion ||
      next.version !== expectedVersion + 1 ||
      !keepsStableIdentity(current, next)
    ) {
      return false
    }

    records.set(next.jobId, next)
    return true
  }

  return Object.freeze({
    save,

    async replace(
      job: ProductionJob,
      expectedVersion: number,
    ): Promise<boolean> {
      return save(job, expectedVersion)
    },

    async getById(jobId: string): Promise<ProductionJob | null> {
      const stored = records.get(jobId)
      if (stored === undefined) return null
      return rehydrateProductionJob(
        copyRecord(stored),
        TRUSTED_REHYDRATION_ACCESS,
      )
    },

    async exists(jobId: string): Promise<boolean> {
      return records.has(jobId)
    },
  })
}
