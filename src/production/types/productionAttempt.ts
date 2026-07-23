export type ProductionAttemptStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'

export interface ProductionAttemptErrorInformation {
  readonly code: string
  readonly message: string
  readonly retryable?: boolean
}

export interface ProductionAttempt {
  readonly attemptId: string
  readonly jobId: string
  readonly provider: string
  readonly providerRequestId?: string
  readonly generationId?: string
  readonly status: ProductionAttemptStatus
  readonly errorInformation?: ProductionAttemptErrorInformation
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ProductionAttemptSummary {
  readonly attemptId: string
  readonly provider: string
  readonly providerRequestId?: string
  readonly generationId?: string
  readonly status: ProductionAttemptStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ProductionAttemptIssue {
  readonly code:
    | 'INVALID_ATTEMPT_ID'
    | 'INVALID_JOB_ID'
    | 'INVALID_PROVIDER'
    | 'INVALID_PROVIDER_REQUEST_ID'
    | 'INVALID_GENERATION_ID'
    | 'INVALID_INITIAL_STATUS'
    | 'INVALID_ERROR_INFORMATION'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_CURRENT_STATUS'
    | 'INVALID_TARGET_STATUS'
    | 'INVALID_TRANSITION'
    | 'TIMESTAMP_REGRESSION'
  readonly message: string
}

export type ProductionAttemptCreationResult =
  | {
      readonly ok: true
      readonly attempt: ProductionAttempt
    }
  | {
      readonly ok: false
      readonly issues: readonly ProductionAttemptIssue[]
    }

export type ProductionAttemptTransitionValidationResult =
  | {
      readonly valid: true
    }
  | {
      readonly valid: false
      readonly issues: readonly ProductionAttemptIssue[]
    }

export interface ProductionAttemptTransitionUpdate {
  readonly providerRequestId?: string
  readonly generationId?: string
  readonly errorInformation?: ProductionAttemptErrorInformation
}

export type ProductionAttemptTransitionResult =
  | {
      readonly ok: true
      readonly attempt: ProductionAttempt
    }
  | {
      readonly ok: false
      readonly issues: readonly ProductionAttemptIssue[]
    }
