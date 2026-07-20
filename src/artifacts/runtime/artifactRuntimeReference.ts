export interface ArtifactRuntimeLocation {
  readonly type: 'local-file'
  readonly path: string
}

export interface ArtifactRuntimeMetadata {
  readonly mimeType: 'video/mp4'
  readonly size: number
  readonly duration?: number
  readonly width?: number
  readonly height?: number
}

export interface ArtifactRuntimeReference {
  readonly artifactId: string
  readonly artifactType: 'video'
  readonly location: ArtifactRuntimeLocation
  readonly metadata: ArtifactRuntimeMetadata
}
