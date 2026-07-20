export type ArtifactValidationStatus = 'verified' | 'failed' | 'pending'

export interface ArtifactValidationCheck {
  readonly name: string
  readonly passed: boolean
  readonly message?: string
}

export interface ArtifactValidation {
  readonly status: ArtifactValidationStatus
  readonly checks: ArtifactValidationCheck[]
}
