export type ProductionArtifactStatus =
  | 'CREATED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'ARCHIVED'

export interface ProductionArtifactSourceMetadata {
  readonly taskId: string
  readonly providerTaskId: string
}

export interface ProductionArtifact {
  readonly artifactId: string
  readonly candidateId: string
  readonly generationOutputId: string
  readonly generationResultId: string
  readonly providerId: string
  readonly outputReference: string
  readonly mediaType: 'video'
  readonly format: string
  readonly status: ProductionArtifactStatus
  readonly sourceMetadata: ProductionArtifactSourceMetadata
}
