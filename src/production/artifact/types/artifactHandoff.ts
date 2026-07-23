import type { VideoReference } from '../../provider'

export interface ProductionArtifactHandoffRequest {
  readonly handoffId: string
  readonly productionJobId: string
  readonly productionAttemptId: string
  readonly videoReference: VideoReference
}

export interface ArtifactHandoffIssue {
  readonly code:
    | 'INVALID_HANDOFF_REQUEST'
    | 'INVALID_HANDOFF_ID'
    | 'INVALID_PRODUCTION_JOB_ID'
    | 'INVALID_PRODUCTION_ATTEMPT_ID'
    | 'INVALID_VIDEO_REFERENCE'
    | 'FORBIDDEN_FIELD'
    | 'ARTIFACT_HANDOFF_FAILED'
    | 'INVALID_HANDOFF_RESULT'
  readonly message: string
  readonly path?: string
}

export type ProductionArtifactHandoffRequestCreationResult =
  | {
      readonly ok: true
      readonly request: ProductionArtifactHandoffRequest
    }
  | {
      readonly ok: false
      readonly issues: readonly ArtifactHandoffIssue[]
    }

export type ArtifactHandoffResult =
  | {
      readonly ok: true
      readonly handoffId: string
    }
  | {
      readonly ok: false
      readonly issues: readonly ArtifactHandoffIssue[]
    }

export type ArtifactHandoffValidationResult =
  | {
      readonly valid: true
    }
  | {
      readonly valid: false
      readonly issues: readonly ArtifactHandoffIssue[]
    }

export interface ArtifactConsumer {
  handoff(
    request: ProductionArtifactHandoffRequest,
  ): Promise<ArtifactHandoffResult>
}
