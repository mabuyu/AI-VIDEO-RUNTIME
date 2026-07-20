import type {
  ArtifactEnvelope,
  ArtifactValidation,
} from '../contracts'

export interface ArtifactValidationIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
}

export interface ArtifactValidationResult {
  readonly valid: boolean
  readonly validation: ArtifactValidation
  readonly issues: readonly ArtifactValidationIssue[]
}

export interface ArtifactValidator {
  validate(artifact: ArtifactEnvelope): Promise<ArtifactValidationResult>
}
