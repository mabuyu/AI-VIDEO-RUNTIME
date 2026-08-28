export type ProductionJobStatus =
  | 'CREATED'
  | 'SCHEDULED'
  | 'CLAIMED'
  | 'RUNNING'
  | 'RETRY_WAIT'
  | 'RECOVERY_PENDING'
  | 'COMPLETED'
  | 'FAILED'

export type ProductionAttemptId = `production-attempt:${string}:${number}`

export interface ProductionJobLease {
  readonly leaseId: string
  readonly workerId: string
  /** Active snapshots require expiresAt to be later than their updatedAt. */
  readonly expiresAt: string
}

export interface ProductionJob {
  readonly jobId: string
  readonly planId: string
  readonly requestId: string
  readonly status: ProductionJobStatus
  readonly version: number
  readonly attemptCount: number
  /** Positive safe integer; defaults to 3 when omitted at creation. */
  readonly maxAttempts: number
  /** Most recently claimed attempt; null until the first claim. */
  readonly currentAttemptId: ProductionAttemptId | null
  readonly lease: ProductionJobLease | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateProductionJobOptions {
  /** Positive safe integer; defaults to 3. */
  readonly maxAttempts?: number
  /** Valid timestamp; defaults to the factory call time. */
  readonly createdAt?: string
}

export type ProductionJobIssueCode =
  | 'INVALID_PRODUCTION_PLAN'
  | 'INVALID_CREATE_OPTIONS'
  | 'INVALID_MAX_ATTEMPTS'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_JOB'
  | 'INVALID_CURRENT_STATUS'
  | 'INVALID_COMMAND'
  | 'INVALID_TRANSITION'
  | 'TIMESTAMP_REGRESSION'
  | 'INVALID_LEASE'
  | 'MAX_ATTEMPTS_REACHED'

export interface ProductionJobIssue {
  readonly code: ProductionJobIssueCode
  readonly message: string
  readonly path?: string
}

export type ProductionJobCreationResult =
  | {
      readonly ok: true
      readonly job: ProductionJob
    }
  | {
      readonly ok: false
      readonly issues: readonly ProductionJobIssue[]
    }

export type ProductionJobTransitionCommand =
  | {
      readonly type: 'SCHEDULE'
      readonly updatedAt: string
    }
  | {
      readonly type: 'CLAIM'
      readonly workerId: string
      readonly leaseId: string
      readonly expiresAt: string
      readonly updatedAt: string
    }
  | {
      readonly type: 'START'
      readonly updatedAt: string
    }
  | {
      readonly type: 'COMPLETE'
      readonly updatedAt: string
    }
  | {
      readonly type: 'WAIT_FOR_RETRY'
      readonly updatedAt: string
    }
  | {
      readonly type: 'MARK_RECOVERY_PENDING'
      readonly updatedAt: string
    }
  | {
      readonly type: 'RESCHEDULE'
      readonly updatedAt: string
    }
  | {
      readonly type: 'FAIL'
      readonly updatedAt: string
    }

export type ProductionJobTransitionResult =
  | {
      readonly ok: true
      readonly job: ProductionJob
    }
  | {
      readonly ok: false
      readonly issues: readonly ProductionJobIssue[]
    }

export interface ProductionJobStateAuthority {
  readonly transition: (
    job: ProductionJob,
    command: ProductionJobTransitionCommand,
  ) => ProductionJobTransitionResult
}
