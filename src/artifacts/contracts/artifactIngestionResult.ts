import type { ArtifactCandidate } from './artifactCandidate'

export type ArtifactIngestionIssueCode =
  | 'INVALID_GENERATION_OUTPUT'
  | 'INVALID_GENERATION_OUTPUT_ID'
  | 'INVALID_GENERATION_RESULT_ID'
  | 'INVALID_PROVIDER_ID'
  | 'INVALID_OUTPUT_REFERENCE'
  | 'INVALID_MEDIA_TYPE'
  | 'INVALID_FORMAT'
  | 'INVALID_SOURCE_METADATA'

export interface ArtifactIngestionIssue {
  readonly code: ArtifactIngestionIssueCode
  readonly message: string
  readonly path?: string
}

export type ArtifactIngestionResult =
  | {
      readonly ok: true
      readonly candidate: ArtifactCandidate
    }
  | {
      readonly ok: false
      readonly issues: readonly ArtifactIngestionIssue[]
    }
