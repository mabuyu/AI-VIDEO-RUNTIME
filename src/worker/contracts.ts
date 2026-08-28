import type { ExecutionManager, ExecutionResult } from '../execution/types'
import type {
  ProductionJob,
  ProductionJobStateAuthority,
} from '../jobs'
import type { ProductionPlan } from '../production/contracts'
import type {
  ProductionJobDispatch,
  ProductionJobQueue,
} from '../queue'

export interface ProductionPlanSource {
  readonly resolve: (planId: string) => Promise<ProductionPlan | null>
}

export interface ProductionJobStore {
  readonly getById: (jobId: string) => Promise<ProductionJob | null>
  readonly replace: (
    job: ProductionJob,
    expectedVersion: number,
  ) => Promise<boolean>
}

export interface ProductionJobWorkerExecutionContext {
  readonly workerId: string
  readonly leaseId: string
  readonly now: string
  readonly leaseExpiresAt: string
}

export type ProductionJobWorkerOutcome =
  | 'NO_DISPATCH'
  | 'COMPLETED'
  | 'EXECUTION_FAILED'
  | 'DISPATCH_REJECTED'
  | 'JOB_NOT_FOUND'
  | 'PLAN_NOT_FOUND'
  | 'CLAIM_FAILED'
  | 'EXECUTION_ERROR'
  | 'COMPLETION_FAILED'

export type ProductionJobWorkerIssueCode =
  | 'QUEUE_RECEIVE_FAILED'
  | 'QUEUE_ACK_FAILED'
  | 'INVALID_DISPATCH'
  | 'INVALID_EXECUTION_CONTEXT'
  | 'JOB_LOOKUP_FAILED'
  | 'JOB_NOT_FOUND'
  | 'JOB_CORRELATION_MISMATCH'
  | 'STALE_DISPATCH'
  | 'CLAIM_TRANSITION_FAILED'
  | 'CLAIM_STORE_CONFLICT'
  | 'START_TRANSITION_FAILED'
  | 'START_STORE_CONFLICT'
  | 'PLAN_LOOKUP_FAILED'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_CORRELATION_MISMATCH'
  | 'EXECUTION_MANAGER_ERROR'
  | 'INVALID_EXECUTION_RESULT'
  | 'EXECUTION_RESULT_CORRELATION_MISMATCH'
  | 'NON_TERMINAL_EXECUTION_RESULT'
  | 'COMPLETION_TRANSITION_FAILED'
  | 'COMPLETION_STORE_CONFLICT'

export interface ProductionJobWorkerIssue {
  readonly code: ProductionJobWorkerIssueCode
  readonly message: string
}

export interface ProductionJobWorkerResult {
  readonly outcome: ProductionJobWorkerOutcome
  readonly dispatch: ProductionJobDispatch | null
  readonly job: ProductionJob | null
  readonly executionResult: ExecutionResult | null
  readonly issues: readonly ProductionJobWorkerIssue[]
}

export interface ProductionJobWorkerDependencies {
  readonly stateAuthority: ProductionJobStateAuthority
  readonly jobStore: ProductionJobStore
  readonly planSource: ProductionPlanSource
  readonly queue: ProductionJobQueue
  readonly executionManager: ExecutionManager
}

export interface ProductionJobWorker {
  readonly processNext: (
    context: ProductionJobWorkerExecutionContext,
  ) => Promise<ProductionJobWorkerResult>
}
