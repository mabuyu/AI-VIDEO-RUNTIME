export interface ProductionOutputSpecification {
  readonly mediaType: 'video'
  readonly format: string
}

export interface ProductionRequest {
  readonly requestId: string
  readonly generationIntent: string
  readonly outputSpecification: ProductionOutputSpecification
}

export interface GenerationTask {
  readonly taskId: string
  readonly requestId: string
  readonly providerId: string
  readonly generationIntent: string
  readonly outputSpecification: ProductionOutputSpecification
}

export interface ProductionPlan {
  readonly planId: string
  readonly requestId: string
  readonly tasks: readonly GenerationTask[]
}

export type GenerationStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

export interface GenerationOutput {
  readonly mediaType: 'video'
  readonly format: string
  readonly reference: string
}

export interface GenerationIssue {
  readonly code: string
  readonly message: string
  readonly retryable?: boolean
}

export interface GenerationResult {
  readonly taskId: string
  readonly providerId: string
  readonly providerTaskId: string | null
  readonly status: GenerationStatus
  readonly output: GenerationOutput | null
  readonly issues: readonly GenerationIssue[]
}

export interface ProductionValidationIssue {
  readonly code:
    | 'INVALID_PRODUCTION_REQUEST'
    | 'INVALID_PRODUCTION_PLAN'
    | 'INVALID_GENERATION_TASK'
    | 'INVALID_GENERATION_RESULT'
    | 'DUPLICATE_TASK_ID'
    | 'REQUEST_ID_MISMATCH'
  readonly message: string
  readonly path?: string
}

export type ProductionValidationResult =
  | {
      readonly valid: true
    }
  | {
      readonly valid: false
      readonly issues: readonly ProductionValidationIssue[]
    }
