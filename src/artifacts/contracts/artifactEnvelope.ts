import type {
  ArtifactLocationType,
  ArtifactStatus,
  ArtifactType,
} from './artifactTypes'
import type { ArtifactValidation } from './artifactValidation'

export interface ArtifactSource {
  readonly provider: string
  readonly model?: string
  readonly generationId?: string
  readonly reference?: string
}

export interface ArtifactLocation {
  readonly type: ArtifactLocationType
  readonly path: string
}

export interface ArtifactMetadata {
  readonly mimeType: string
  readonly size: number
  readonly duration?: number
  readonly width?: number
  readonly height?: number
}

export interface ArtifactEnvelope {
  readonly artifactId: string
  readonly artifactType: ArtifactType
  readonly status: ArtifactStatus
  readonly source: ArtifactSource
  readonly location: ArtifactLocation
  readonly metadata: ArtifactMetadata
  readonly validation: ArtifactValidation
}
