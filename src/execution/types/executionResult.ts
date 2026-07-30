import type { GenerationOutput } from '../../artifacts/contracts'
import type { GenerationResult } from '../../production/contracts'

export type ExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'

export interface ExecutionError {
  readonly code:
    | 'INVALID_PRODUCTION_PLAN'
    | 'PROVIDER_ADAPTER_NOT_FOUND'
    | 'PROVIDER_EXECUTION_FAILED'
    | 'INVALID_GENERATION_RESULT'
    | 'GENERATION_OUTPUT_ADAPTATION_FAILED'
    | 'RESULT_CORRELATION_MISMATCH'
    | 'GENERATION_TASK_FAILED'
  readonly message: string
  readonly taskId?: string
  readonly providerId?: string
}

export interface ExecutionResult {
  readonly executionId: string
  readonly planId: string
  readonly status: ExecutionStatus
  readonly results: readonly GenerationResult[]
  readonly generationOutputs: readonly GenerationOutput[]
  readonly errors: readonly ExecutionError[]
}
