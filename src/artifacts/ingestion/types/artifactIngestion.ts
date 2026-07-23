import type { VideoReference } from '../../../production/provider'

export interface ArtifactIngestionProductionContext {
  readonly productionJobId: string
  readonly productionAttemptId: string
}

export interface ArtifactIngestionRequest {
  readonly ingestionId: string
  readonly sourceReference: VideoReference
  readonly productionContext: ArtifactIngestionProductionContext
}

export interface ArtifactCandidate {
  readonly candidateId: string
  readonly sourceReference: VideoReference
  readonly productionContext: ArtifactIngestionProductionContext
}

export interface ArtifactIngestionIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
}

export type ArtifactIngestionResult =
  | {
      readonly ok: true
      readonly candidateId: string
    }
  | {
      readonly ok: false
      readonly issues: readonly ArtifactIngestionIssue[]
    }

export type ArtifactIngestionValidationResult =
  | {
      readonly valid: true
    }
  | {
      readonly valid: false
      readonly issues: readonly ArtifactIngestionIssue[]
    }

export interface ArtifactIngestionPort {
  ingest(request: ArtifactIngestionRequest): Promise<ArtifactIngestionResult>
}
