import type { ExecutionResult } from '../execution/types'
import type {
  ProductionAttemptId,
  ProductionJob,
  ProductionJobLease,
  ProductionJobStateAuthority,
  ProductionJobStatus,
} from '../jobs'
import type {
  ProductionJobDispatch,
  ProductionJobQueue,
} from '../queue'
import type { ProductionJobStore } from '../worker'

export interface ProductionJobRecord {
  readonly jobId: string
  readonly planId: string
  readonly requestId: string
  readonly status: ProductionJobStatus
  readonly version: number
  readonly attemptCount: number
  readonly maxAttempts: number
  readonly currentAttemptId: ProductionAttemptId | null
  readonly lease: ProductionJobLease | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ProductionJobRepository extends ProductionJobStore {
  /** null expectedVersion inserts a new version-zero Job. */
  readonly save: (
    job: ProductionJob,
    expectedVersion: number | null,
  ) => Promise<boolean>
  readonly exists: (jobId: string) => Promise<boolean>
}

export type ProductionFailureClassification =
  | 'RETRYABLE'
  | 'NON_RETRYABLE'

export interface ProductionExecutionFailureEvidence {
  readonly executionId: string
  readonly planId: string
  readonly code: string
  readonly message: string
  readonly classification: ProductionFailureClassification
  readonly occurredAt: string
}

export interface CreateProductionExecutionFailureEvidenceInput {
  readonly executionResult: ExecutionResult
  readonly code: string
  readonly message: string
  readonly classification: ProductionFailureClassification
  readonly occurredAt: string
}

export type ProductionAttemptOutcome = 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface ProductionAttemptRecord {
  readonly attemptId: ProductionAttemptId
  readonly jobId: string
  readonly attemptNumber: number
  readonly executionId: string
  readonly outcome: ProductionAttemptOutcome
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly failureClassification: ProductionFailureClassification | null
}

export interface CreateProductionAttemptRecordInput {
  readonly job: ProductionJob
  readonly executionId: string
  readonly outcome: ProductionAttemptOutcome
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly failureClassification: ProductionFailureClassification | null
}

export interface ProductionJobRetryPolicyInput {
  readonly job: ProductionJob
  readonly failure: ProductionExecutionFailureEvidence
  readonly attempt: ProductionAttemptRecord
}

export type ProductionJobRetryDecisionReason =
  | 'RETRYABLE_FAILURE'
  | 'NON_RETRYABLE_FAILURE'
  | 'ATTEMPT_BUDGET_EXHAUSTED'

export type ProductionJobRetryDecision =
  | {
      readonly decision: 'RETRY'
      readonly reason: 'RETRYABLE_FAILURE'
      readonly nextAvailableAt: string
    }
  | {
      readonly decision: 'FAIL'
      readonly reason:
        | 'NON_RETRYABLE_FAILURE'
        | 'ATTEMPT_BUDGET_EXHAUSTED'
      readonly nextAvailableAt: null
    }

export interface ProductionJobRetryPolicy {
  readonly decide: (
    input: ProductionJobRetryPolicyInput,
  ) => ProductionJobRetryDecision
}

export interface FixedProductionJobRetryPolicyOptions {
  readonly delayMilliseconds: number
}

export interface ProductionJobRetrySchedule {
  readonly jobId: string
  readonly jobVersion: number
  readonly availableAt: string
}

export interface ProductionJobRetryScheduleStore {
  readonly save: (schedule: ProductionJobRetrySchedule) => Promise<boolean>
  readonly getByJobId: (
    jobId: string,
  ) => Promise<ProductionJobRetrySchedule | null>
  readonly remove: (
    jobId: string,
    expectedJobVersion: number,
  ) => Promise<boolean>
}

export type JobDispatchOutboxEntryId = `job-dispatch-outbox:${string}`
export type JobDispatchOutboxEntryStatus = 'PENDING' | 'DISPATCHED'

export interface JobDispatchOutboxEntry {
  readonly outboxEntryId: JobDispatchOutboxEntryId
  readonly dispatch: ProductionJobDispatch
  readonly status: JobDispatchOutboxEntryStatus
  readonly createdAt: string
  readonly dispatchedAt: string | null
}

export interface JobDispatchOutbox {
  readonly append: (
    dispatch: ProductionJobDispatch,
    createdAt: string,
  ) => Promise<JobDispatchOutboxEntry>
  readonly listPending: () => Promise<readonly JobDispatchOutboxEntry[]>
  readonly markDispatched: (
    outboxEntryId: string,
    dispatchedAt: string,
  ) => Promise<boolean>
}

export interface ProductionJobOutboxDispatchResult {
  readonly dispatchedCount: number
  readonly failedCount: number
}

export interface ProductionJobOutboxDispatcher {
  readonly dispatchPending: (
    dispatchedAt: string,
  ) => Promise<ProductionJobOutboxDispatchResult>
}

export interface ProductionJobRecoveryCoordinatorDependencies {
  readonly stateAuthority: ProductionJobStateAuthority
  readonly repository: ProductionJobRepository
  readonly retryPolicy: ProductionJobRetryPolicy
  readonly retrySchedules: ProductionJobRetryScheduleStore
  readonly outbox: JobDispatchOutbox
}

export interface ReportProductionExecutionFailureCommand {
  readonly jobId: string
  readonly expectedVersion: number
  readonly failure: ProductionExecutionFailureEvidence
  readonly attempt: ProductionAttemptRecord
  readonly updatedAt: string
}

export interface RecoverExpiredProductionJobCommand {
  readonly jobId: string
  readonly expectedVersion: number
  readonly updatedAt: string
}

export interface ProcessDueProductionJobRetryCommand {
  readonly jobId: string
  readonly expectedVersion: number
  readonly updatedAt: string
}

export type ResolveProductionJobRecoveryCommand =
  | {
      readonly jobId: string
      readonly expectedVersion: number
      readonly action: 'RESCHEDULE'
      readonly updatedAt: string
      readonly availableAt: string
    }
  | {
      readonly jobId: string
      readonly expectedVersion: number
      readonly action: 'FAIL'
      readonly updatedAt: string
    }

export type ProductionJobRecoveryOutcome =
  | 'RETRY_WAIT'
  | 'RECOVERY_PENDING'
  | 'SCHEDULED'
  | 'FAILED'
  | 'NOT_DUE'
  | 'JOB_NOT_FOUND'
  | 'STALE_VERSION'
  | 'REJECTED'

export interface ProductionJobRecoveryResult {
  readonly outcome: ProductionJobRecoveryOutcome
  readonly job: ProductionJob | null
  readonly decision: ProductionJobRetryDecision | null
  readonly dispatch: ProductionJobDispatch | null
  readonly issues: readonly string[]
}

export interface ProductionJobRecoveryCoordinator {
  readonly reportExecutionFailure: (
    command: ReportProductionExecutionFailureCommand,
  ) => Promise<ProductionJobRecoveryResult>
  readonly recoverExpiredLease: (
    command: RecoverExpiredProductionJobCommand,
  ) => Promise<ProductionJobRecoveryResult>
  readonly processDueRetry: (
    command: ProcessDueProductionJobRetryCommand,
  ) => Promise<ProductionJobRecoveryResult>
  readonly resolveRecovery: (
    command: ResolveProductionJobRecoveryCommand,
  ) => Promise<ProductionJobRecoveryResult>
}

export interface ProductionJobOutboxDispatcherDependencies {
  readonly outbox: JobDispatchOutbox
  readonly queue: ProductionJobQueue
}
