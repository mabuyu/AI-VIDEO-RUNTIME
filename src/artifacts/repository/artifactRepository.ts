import type {
  ProductionArtifact,
  ProductionArtifactStatus,
} from '../entities'

export interface ProductionArtifactRecord {
  readonly artifactId: string
  readonly candidateId: string
  readonly generationOutputId: string
  readonly generationResultId: string
  readonly providerId: string
  readonly outputReference: string
  readonly mediaType: 'video'
  readonly format: string
  readonly status: ProductionArtifactStatus
  readonly sourceMetadata: {
    readonly taskId: string
    readonly providerTaskId: string
  }
}

export interface ArtifactRepository {
  readonly save: (artifact: ProductionArtifact) => Promise<void>
  readonly getById: (
    artifactId: string,
  ) => Promise<ProductionArtifact | null>
  readonly exists: (artifactId: string) => Promise<boolean>
}
