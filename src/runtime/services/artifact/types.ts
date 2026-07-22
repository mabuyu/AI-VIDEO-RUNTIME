import type {
  ArtifactRuntimeLocation,
  ArtifactRuntimeReference,
} from '../../../artifacts/runtime'

export interface RuntimeArtifactResource {
  readonly type: 'runtime-video-source'
  readonly source: string
}

export interface RuntimeArtifactInputMetadata {
  readonly mimeType: 'video/mp4'
  readonly size: number
  readonly duration?: number
  readonly width?: number
  readonly height?: number
}

export interface RuntimeArtifactInput {
  readonly artifactId: string
  readonly artifactType: 'video'
  readonly resource: RuntimeArtifactResource
  readonly metadata: RuntimeArtifactInputMetadata
}

export type RuntimeArtifactConsumptionIssueCode =
  | 'UNSUPPORTED_ARTIFACT_TYPE'
  | 'UNSUPPORTED_LOCATION_TYPE'
  | 'RESOLUTION_FAILED'
  | 'CONSUMPTION_FAILED'

export interface RuntimeArtifactConsumptionIssue {
  readonly code: RuntimeArtifactConsumptionIssueCode
  readonly message: string
}

export type RuntimeArtifactConsumptionResult =
  | { readonly ok: true; readonly input: RuntimeArtifactInput }
  | {
      readonly ok: false
      readonly issues: readonly RuntimeArtifactConsumptionIssue[]
    }

export type RuntimeArtifactResolutionResult =
  | { readonly ok: true; readonly resource: RuntimeArtifactResource }
  | {
      readonly ok: false
      readonly issues: readonly RuntimeArtifactConsumptionIssue[]
    }

export interface RuntimeArtifactResolver {
  resolve(
    location: ArtifactRuntimeLocation,
    artifactType: 'video',
  ): Promise<RuntimeArtifactResolutionResult>
}

export interface RuntimeArtifactConsumer {
  consume(
    reference: ArtifactRuntimeReference,
  ): Promise<RuntimeArtifactConsumptionResult>
}
