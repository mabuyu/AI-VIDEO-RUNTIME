import type { VideoReference } from './videoReference'

export interface GenerationOutputSpecification {
  readonly mediaType: 'video'
  readonly format: string
}

export interface GenerationRequest {
  readonly requestId: string
  readonly generationIntent: string
  readonly outputSpecification: GenerationOutputSpecification
}

export interface VideoProvider {
  generate(request: GenerationRequest): Promise<VideoReference>
}

export interface ProviderExecutionIssue {
  readonly code:
    | 'INVALID_REQUEST'
    | 'INVALID_GENERATION_INTENT'
    | 'INVALID_OUTPUT_SPECIFICATION'
    | 'FORBIDDEN_FIELD'
    | 'PROVIDER_EXECUTION_FAILED'
    | 'INVALID_VIDEO_REFERENCE'
    | 'PARTIAL_VIDEO_REFERENCE'
  readonly message: string
  readonly path?: string
}

export type ProviderExecutionResult =
  | {
      readonly ok: true
      readonly reference: VideoReference
    }
  | {
      readonly ok: false
      readonly issues: readonly ProviderExecutionIssue[]
    }

export type ProviderExecutionValidationResult =
  | {
      readonly valid: true
    }
  | {
      readonly valid: false
      readonly issues: readonly ProviderExecutionIssue[]
    }
