import type { ProductionPlan } from '../production/contracts'
import { validateProductionPlan } from '../production/validation'
import type {
  CreateProductionJobOptions,
  ProductionAttemptId,
  ProductionJob,
  ProductionJobCreationResult,
  ProductionJobIssue,
  ProductionJobIssueCode,
  ProductionJobLease,
  ProductionJobStateAuthority,
  ProductionJobStatus,
  ProductionJobTransitionCommand,
  ProductionJobTransitionResult,
} from './contracts/productionJob'

const DEFAULT_MAX_ATTEMPTS = 3
const PRODUCTION_JOB_KEYS: readonly string[] = Object.freeze([
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
const PRODUCTION_JOB_LEASE_KEYS: readonly string[] = Object.freeze([
  'leaseId',
  'workerId',
  'expiresAt',
])
const CREATE_OPTION_KEYS: readonly string[] = Object.freeze([
  'maxAttempts',
  'createdAt',
])
const PRODUCTION_JOB_STATUSES: readonly ProductionJobStatus[] = Object.freeze([
  'CREATED',
  'SCHEDULED',
  'CLAIMED',
  'RUNNING',
  'RETRY_WAIT',
  'RECOVERY_PENDING',
  'COMPLETED',
  'FAILED',
])

type ProductionJobTransitionCommandType =
  ProductionJobTransitionCommand['type']

const TRANSITION_COMMAND_TYPES: readonly ProductionJobTransitionCommandType[] =
  Object.freeze([
    'SCHEDULE',
    'CLAIM',
    'START',
    'COMPLETE',
    'WAIT_FOR_RETRY',
    'MARK_RECOVERY_PENDING',
    'RESCHEDULE',
    'FAIL',
  ])
const COMMAND_KEYS: Readonly<
  Record<ProductionJobTransitionCommandType, readonly string[]>
> = Object.freeze({
  SCHEDULE: Object.freeze(['type', 'updatedAt']),
  CLAIM: Object.freeze([
    'type',
    'workerId',
    'leaseId',
    'expiresAt',
    'updatedAt',
  ]),
  START: Object.freeze(['type', 'updatedAt']),
  COMPLETE: Object.freeze(['type', 'updatedAt']),
  WAIT_FOR_RETRY: Object.freeze(['type', 'updatedAt']),
  MARK_RECOVERY_PENDING: Object.freeze(['type', 'updatedAt']),
  RESCHEDULE: Object.freeze(['type', 'updatedAt']),
  FAIL: Object.freeze(['type', 'updatedAt']),
})
const COMMAND_TARGET_STATUS: Readonly<
  Record<ProductionJobTransitionCommandType, ProductionJobStatus>
> = Object.freeze({
  SCHEDULE: 'SCHEDULED',
  CLAIM: 'CLAIMED',
  START: 'RUNNING',
  COMPLETE: 'COMPLETED',
  WAIT_FOR_RETRY: 'RETRY_WAIT',
  MARK_RECOVERY_PENDING: 'RECOVERY_PENDING',
  RESCHEDULE: 'SCHEDULED',
  FAIL: 'FAILED',
})
const ALLOWED_COMMANDS: Readonly<
  Record<ProductionJobStatus, readonly ProductionJobTransitionCommandType[]>
> = Object.freeze({
  CREATED: Object.freeze<ProductionJobTransitionCommandType[]>(['SCHEDULE']),
  SCHEDULED: Object.freeze<ProductionJobTransitionCommandType[]>(['CLAIM']),
  CLAIMED: Object.freeze<ProductionJobTransitionCommandType[]>([
    'START',
    'MARK_RECOVERY_PENDING',
  ]),
  RUNNING: Object.freeze<ProductionJobTransitionCommandType[]>([
    'COMPLETE',
    'WAIT_FOR_RETRY',
    'MARK_RECOVERY_PENDING',
    'FAIL',
  ]),
  RETRY_WAIT: Object.freeze<ProductionJobTransitionCommandType[]>([
    'RESCHEDULE',
  ]),
  RECOVERY_PENDING: Object.freeze<ProductionJobTransitionCommandType[]>([
    'RESCHEDULE',
    'FAIL',
  ]),
  COMPLETED: Object.freeze<ProductionJobTransitionCommandType[]>([]),
  FAILED: Object.freeze<ProductionJobTransitionCommandType[]>([]),
})
const ALLOWED_TRANSITIONS: Readonly<
  Record<ProductionJobStatus, readonly ProductionJobStatus[]>
> = Object.freeze({
  CREATED: Object.freeze<ProductionJobStatus[]>(['SCHEDULED']),
  SCHEDULED: Object.freeze<ProductionJobStatus[]>(['CLAIMED']),
  CLAIMED: Object.freeze<ProductionJobStatus[]>([
    'RUNNING',
    'RECOVERY_PENDING',
  ]),
  RUNNING: Object.freeze<ProductionJobStatus[]>([
    'COMPLETED',
    'RETRY_WAIT',
    'RECOVERY_PENDING',
    'FAILED',
  ]),
  RETRY_WAIT: Object.freeze<ProductionJobStatus[]>(['SCHEDULED']),
  RECOVERY_PENDING: Object.freeze<ProductionJobStatus[]>([
    'SCHEDULED',
    'FAILED',
  ]),
  COMPLETED: Object.freeze<ProductionJobStatus[]>([]),
  FAILED: Object.freeze<ProductionJobStatus[]>([]),
})

const authorizedProductionJobSnapshots = new WeakSet<object>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value)
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  )
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key))
}

function materializeBoundaryValue(
  value: unknown,
  seen: WeakMap<object, unknown> = new WeakMap(),
): unknown {
  if (typeof value !== 'object' || value === null) return value

  const existingSnapshot = seen.get(value)
  if (existingSnapshot !== undefined) return existingSnapshot

  if (Array.isArray(value)) {
    const snapshot: unknown[] = []
    seen.set(value, snapshot)
    for (let index = 0; index < value.length; index += 1) {
      if (index in value) {
        snapshot[index] = materializeBoundaryValue(value[index], seen)
      }
    }
    return snapshot
  }

  const snapshot: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >
  seen.set(value, snapshot)
  for (const key of Object.keys(value)) {
    snapshot[key] = materializeBoundaryValue(
      (value as Record<string, unknown>)[key],
      seen,
    )
  }
  return snapshot
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

function isValidTimestamp(value: unknown): value is string {
  return isBoundaryString(value) && Number.isFinite(Date.parse(value))
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isProductionJobStatus(
  value: unknown,
): value is ProductionJobStatus {
  return PRODUCTION_JOB_STATUSES.some((status) => status === value)
}

function isTransitionCommandType(
  value: unknown,
): value is ProductionJobTransitionCommandType {
  return TRANSITION_COMMAND_TYPES.some((type) => type === value)
}

function createAttemptId(
  jobId: string,
  attemptNumber: number,
): ProductionAttemptId {
  return `production-attempt:${jobId}:${attemptNumber}`
}

function freezeLease(lease: ProductionJobLease): ProductionJobLease {
  return Object.freeze({
    leaseId: lease.leaseId,
    workerId: lease.workerId,
    expiresAt: lease.expiresAt,
  })
}

function authorizeProductionJobSnapshot(job: ProductionJob): ProductionJob {
  const snapshot: ProductionJob = Object.freeze({
    jobId: job.jobId,
    planId: job.planId,
    requestId: job.requestId,
    status: job.status,
    version: job.version,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    currentAttemptId: job.currentAttemptId,
    lease: job.lease === null ? null : freezeLease(job.lease),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  })

  authorizedProductionJobSnapshots.add(snapshot)
  return snapshot
}

/** Internal persistence capability. Not re-exported by src/jobs/index.ts. */
export function createAuthorizedRehydratedProductionJobSnapshot(
  job: ProductionJob,
): ProductionJob {
  const snapshot = authorizeProductionJobSnapshot(job)
  if (
    !isProductionJobSnapshot(
      snapshot as unknown as Record<string, unknown>,
    )
  ) {
    throw new TypeError(
      'ProductionJob rehydration requires a valid persisted snapshot',
    )
  }
  return snapshot
}

/** Internal persistence guard. Not re-exported by src/jobs/index.ts. */
export function isAuthorizedProductionJobSnapshot(
  value: object,
): value is ProductionJob {
  try {
    return (
      isRecord(value) &&
      authorizedProductionJobSnapshots.has(value) &&
      isProductionJobSnapshot(value)
    )
  } catch {
    return false
  }
}

function freezeIssues(
  issues: readonly ProductionJobIssue[],
): readonly ProductionJobIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function creationFailure(
  issues: readonly ProductionJobIssue[],
): ProductionJobCreationResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

function transitionFailure(
  code: ProductionJobIssueCode,
  message: string,
  path?: string,
): ProductionJobTransitionResult {
  const issue: ProductionJobIssue =
    path === undefined ? { code, message } : { code, message, path }

  return Object.freeze({
    ok: false,
    issues: freezeIssues([issue]),
  })
}

function isValidLeaseSnapshot(
  value: unknown,
  jobUpdatedAt: string,
): value is ProductionJobLease {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, PRODUCTION_JOB_LEASE_KEYS) ||
    !Object.isFrozen(value) ||
    !isBoundaryString(value.leaseId) ||
    !isBoundaryString(value.workerId) ||
    !isValidTimestamp(value.expiresAt)
  ) {
    return false
  }

  return Date.parse(value.expiresAt) > Date.parse(jobUpdatedAt)
}

function isProductionJobSnapshot(
  value: Record<string, unknown>,
): value is Record<string, unknown> & ProductionJob {
  if (
    !hasExactKeys(value, PRODUCTION_JOB_KEYS) ||
    !Object.isFrozen(value) ||
    !authorizedProductionJobSnapshots.has(value) ||
    !isBoundaryString(value.jobId) ||
    !isBoundaryString(value.planId) ||
    !isBoundaryString(value.requestId) ||
    !isProductionJobStatus(value.status) ||
    !isNonNegativeSafeInteger(value.version) ||
    !isNonNegativeSafeInteger(value.attemptCount) ||
    !isPositiveSafeInteger(value.maxAttempts) ||
    !isValidTimestamp(value.createdAt) ||
    !isValidTimestamp(value.updatedAt)
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
  } else if (
    !isBoundaryString(value.currentAttemptId) ||
    value.currentAttemptId !==
      createAttemptId(value.jobId, value.attemptCount)
  ) {
    return false
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
    return (
      value.attemptCount > 0 &&
      isValidLeaseSnapshot(value.lease, value.updatedAt)
    )
  }

  return value.lease === null
}

function validateTransitionCommand(
  value: unknown,
): ProductionJobIssue | undefined {
  if (!isRecord(value) || !isTransitionCommandType(value.type)) {
    return {
      code: 'INVALID_COMMAND',
      message:
        'ProductionJob transition requires a supported transition command',
    }
  }

  if (!hasExactKeys(value, COMMAND_KEYS[value.type])) {
    return {
      code: 'INVALID_COMMAND',
      message: `${value.type} command contains fields outside its contract`,
    }
  }

  if (!isValidTimestamp(value.updatedAt)) {
    return {
      code: 'INVALID_TIMESTAMP',
      message: `${value.type} command requires a valid updatedAt timestamp`,
      path: 'updatedAt',
    }
  }

  if (
    value.type === 'CLAIM' &&
    (!isBoundaryString(value.workerId) ||
      !isBoundaryString(value.leaseId) ||
      !isValidTimestamp(value.expiresAt) ||
      Date.parse(value.expiresAt) <= Date.parse(value.updatedAt))
  ) {
    return {
      code: 'INVALID_LEASE',
      message:
        'CLAIM requires non-empty workerId and leaseId with expiresAt after updatedAt',
      path: 'lease',
    }
  }

  return undefined
}

export function createProductionJob(
  plan: ProductionPlan,
  options: CreateProductionJobOptions = {},
): ProductionJobCreationResult {
  let planValue: unknown
  try {
    planValue = materializeBoundaryValue(plan)
  } catch {
    return creationFailure([
      {
        code: 'INVALID_PRODUCTION_PLAN',
        message: 'ProductionPlan could not be read as boundary data',
      },
    ])
  }

  const planValidation = validateProductionPlan(planValue)
  if (!planValidation.valid) {
    return creationFailure(
      planValidation.issues.map((issue) => ({
        code: 'INVALID_PRODUCTION_PLAN',
        message: issue.message,
        ...(issue.path === undefined ? {} : { path: issue.path }),
      })),
    )
  }

  if (
    !isRecord(planValue) ||
    !isBoundaryString(planValue.planId) ||
    !isBoundaryString(planValue.requestId)
  ) {
    return creationFailure([
      {
        code: 'INVALID_PRODUCTION_PLAN',
        message:
          'ProductionPlan planId and requestId must be stable boundary strings',
      },
    ])
  }

  let optionValue: unknown
  try {
    optionValue = materializeBoundaryValue(options)
  } catch {
    return creationFailure([
      {
        code: 'INVALID_CREATE_OPTIONS',
        message: 'ProductionJob creation options could not be read as boundary data',
      },
    ])
  }

  if (!isRecord(optionValue) || !hasOnlyKeys(optionValue, CREATE_OPTION_KEYS)) {
    return creationFailure([
      {
        code: 'INVALID_CREATE_OPTIONS',
        message:
          'ProductionJob creation options may contain only maxAttempts and createdAt',
      },
    ])
  }

  const maxAttempts = optionValue.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  if (!isPositiveSafeInteger(maxAttempts)) {
    return creationFailure([
      {
        code: 'INVALID_MAX_ATTEMPTS',
        message: 'ProductionJob maxAttempts must be a positive safe integer',
        path: 'maxAttempts',
      },
    ])
  }

  const createdAt = optionValue.createdAt ?? new Date().toISOString()
  if (!isValidTimestamp(createdAt)) {
    return creationFailure([
      {
        code: 'INVALID_TIMESTAMP',
        message: 'ProductionJob createdAt must be a valid timestamp',
        path: 'createdAt',
      },
    ])
  }

  const planId = planValue.planId
  const requestId = planValue.requestId
  const job = authorizeProductionJobSnapshot({
    jobId: `production-job:${planId}`,
    planId,
    requestId,
    status: 'CREATED',
    version: 0,
    attemptCount: 0,
    maxAttempts,
    currentAttemptId: null,
    lease: null,
    createdAt,
    updatedAt: createdAt,
  })

  return Object.freeze({ ok: true, job })
}

export function createProductionJobStateAuthority(): ProductionJobStateAuthority {
  return Object.freeze({
    transition(
      job: ProductionJob,
      command: ProductionJobTransitionCommand,
    ): ProductionJobTransitionResult {
      const jobValue: unknown = job
      if (typeof jobValue !== 'object' || jobValue === null) {
        return transitionFailure(
          'INVALID_JOB',
          'ProductionJob transition requires an authorized ProductionJob snapshot',
        )
      }

      if (!authorizedProductionJobSnapshots.has(jobValue)) {
        return transitionFailure(
          'INVALID_JOB',
          'ProductionJob transition requires an authorized ProductionJob snapshot',
        )
      }

      const authorizedJobValue = jobValue as Record<string, unknown>
      if (!isProductionJobStatus(authorizedJobValue.status)) {
        return transitionFailure(
          'INVALID_CURRENT_STATUS',
          `Unsupported ProductionJob current status: ${String(authorizedJobValue.status)}`,
        )
      }

      if (!isProductionJobSnapshot(authorizedJobValue)) {
        return transitionFailure(
          'INVALID_JOB',
          'ProductionJob transition requires an immutable authorized snapshot',
        )
      }

      let commandValue: unknown
      try {
        commandValue = materializeBoundaryValue(command)
      } catch {
        return transitionFailure(
          'INVALID_COMMAND',
          'ProductionJob transition command could not be read as boundary data',
        )
      }

      const commandIssue = validateTransitionCommand(commandValue)
      if (commandIssue !== undefined) {
        return transitionFailure(
          commandIssue.code,
          commandIssue.message,
          commandIssue.path,
        )
      }

      const validCommand = commandValue as ProductionJobTransitionCommand
      if (!ALLOWED_COMMANDS[authorizedJobValue.status].includes(validCommand.type)) {
        return transitionFailure(
          'INVALID_TRANSITION',
          `ProductionJob command ${validCommand.type} is not allowed from ${authorizedJobValue.status}`,
        )
      }

      const targetStatus = COMMAND_TARGET_STATUS[validCommand.type]
      if (!ALLOWED_TRANSITIONS[authorizedJobValue.status].includes(targetStatus)) {
        return transitionFailure(
          'INVALID_TRANSITION',
          `ProductionJob transition ${authorizedJobValue.status} -> ${targetStatus} is not allowed`,
        )
      }

      if (
        Date.parse(validCommand.updatedAt) <
        Date.parse(authorizedJobValue.updatedAt)
      ) {
        return transitionFailure(
          'TIMESTAMP_REGRESSION',
          'ProductionJob updatedAt cannot move backward',
          'updatedAt',
        )
      }

      let attemptCount = authorizedJobValue.attemptCount
      let currentAttemptId = authorizedJobValue.currentAttemptId
      let lease: ProductionJobLease | null = null

      if (validCommand.type === 'CLAIM') {
        if (
          authorizedJobValue.attemptCount >= authorizedJobValue.maxAttempts
        ) {
          return transitionFailure(
            'MAX_ATTEMPTS_REACHED',
            'ProductionJob cannot be claimed after maxAttempts is reached',
            'attemptCount',
          )
        }

        attemptCount += 1
        currentAttemptId = createAttemptId(
          authorizedJobValue.jobId,
          attemptCount,
        )
        lease = {
          leaseId: validCommand.leaseId,
          workerId: validCommand.workerId,
          expiresAt: validCommand.expiresAt,
        }
      } else if (validCommand.type === 'START') {
        if (
          authorizedJobValue.lease === null ||
          Date.parse(authorizedJobValue.lease.expiresAt) <=
            Date.parse(validCommand.updatedAt)
        ) {
          return transitionFailure(
            'INVALID_LEASE',
            'START requires a non-expired claimed lease',
            'lease',
          )
        }
        lease = authorizedJobValue.lease
      }

      const transitionedJob = authorizeProductionJobSnapshot({
        jobId: authorizedJobValue.jobId,
        planId: authorizedJobValue.planId,
        requestId: authorizedJobValue.requestId,
        status: targetStatus,
        version: authorizedJobValue.version + 1,
        attemptCount,
        maxAttempts: authorizedJobValue.maxAttempts,
        currentAttemptId,
        lease,
        createdAt: authorizedJobValue.createdAt,
        updatedAt: validCommand.updatedAt,
      })

      return Object.freeze({
        ok: true,
        job: transitionedJob,
      })
    },
  })
}
