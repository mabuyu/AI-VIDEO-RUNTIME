import type { ProductionArtifact } from './productionArtifact'

export type ArtifactMaterializationIssueCode =
  | 'INVALID_ARTIFACT_CANDIDATE'
  | 'INVALID_CANDIDATE_ID'
  | 'INVALID_GENERATION_OUTPUT_ID'
  | 'INVALID_GENERATION_RESULT_ID'
  | 'INVALID_PROVIDER_ID'
  | 'INVALID_OUTPUT_REFERENCE'
  | 'INVALID_MEDIA_TYPE'
  | 'INVALID_FORMAT'
  | 'INVALID_SOURCE_METADATA'

export interface ArtifactMaterializationIssue {
  readonly code: ArtifactMaterializationIssueCode
  readonly message: string
  readonly path?: string
}

export type ArtifactMaterializationResult =
  | {
      readonly ok: true
      readonly artifact: ProductionArtifact
    }
  | {
      readonly ok: false
      readonly issues: readonly ArtifactMaterializationIssue[]
    }
