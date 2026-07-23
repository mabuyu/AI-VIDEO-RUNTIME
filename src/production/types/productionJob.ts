export type ProductionJobStatus =
  | 'CREATED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'

export type ProductionJobAttemptsSummary = readonly never[]

export interface ProductionJob {
  readonly jobId: string
  readonly commandId: string
  readonly status: ProductionJobStatus
  readonly attemptsSummary: ProductionJobAttemptsSummary
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ProductionJobIssue {
  readonly code:
    | 'INVALID_JOB_ID'
    | 'INVALID_COMMAND_ID'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_CURRENT_STATUS'
    | 'INVALID_TARGET_STATUS'
    | 'INVALID_TRANSITION'
    | 'TIMESTAMP_REGRESSION'
  readonly message: string
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

export type ProductionJobTransitionValidationResult =
  | {
      readonly valid: true
    }
  | {
      readonly valid: false
      readonly issues: readonly ProductionJobIssue[]
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
