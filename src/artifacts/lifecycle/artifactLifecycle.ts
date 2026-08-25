import type {
  ProductionArtifact,
  ProductionArtifactStatus,
} from '../entities'

export type ArtifactLifecycleIssueCode =
  | 'INVALID_ARTIFACT'
  | 'INVALID_CURRENT_STATUS'
  | 'INVALID_TARGET_STATUS'
  | 'INVALID_TRANSITION'

export interface ArtifactLifecycleIssue {
  readonly code: ArtifactLifecycleIssueCode
  readonly message: string
}

export type ArtifactLifecycleTransitionResult =
  | {
      readonly ok: true
      readonly artifact: ProductionArtifact
    }
  | {
      readonly ok: false
      readonly issues: readonly ArtifactLifecycleIssue[]
    }

export interface ArtifactLifecycleAuthority {
  readonly transition: (
    artifact: ProductionArtifact,
    targetStatus: ProductionArtifactStatus,
  ) => ArtifactLifecycleTransitionResult
}
