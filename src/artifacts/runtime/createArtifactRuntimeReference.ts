import type { ArtifactEnvelope } from '../contracts'
import type {
  ArtifactRuntimeMetadata,
  ArtifactRuntimeReference,
} from './artifactRuntimeReference'

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0
}

function isPositiveFiniteNumber(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value) && value > 0
}

export function createArtifactRuntimeReference(
  artifactEnvelope: ArtifactEnvelope,
): ArtifactRuntimeReference {
  if (artifactEnvelope.status !== 'READY') {
    throw new Error('ArtifactRuntimeReference requires artifact status READY')
  }

  if (artifactEnvelope.validation.status !== 'verified') {
    throw new Error(
      'ArtifactRuntimeReference requires verified artifact validation',
    )
  }

  if (!isNonEmptyString(artifactEnvelope.artifactId)) {
    throw new Error(
      'ArtifactRuntimeReference requires a non-empty artifactId',
    )
  }

  if (artifactEnvelope.artifactType !== 'video') {
    throw new Error('ArtifactRuntimeReference requires artifact type video')
  }

  if (
    artifactEnvelope.location.type !== 'local-file' ||
    !isNonEmptyString(artifactEnvelope.location.path)
  ) {
    throw new Error(
      'ArtifactRuntimeReference requires a non-empty local-file location',
    )
  }

  if (artifactEnvelope.metadata.mimeType !== 'video/mp4') {
    throw new Error(
      'ArtifactRuntimeReference requires metadata mimeType video/mp4',
    )
  }

  if (!isPositiveFiniteNumber(artifactEnvelope.metadata.size)) {
    throw new Error(
      'ArtifactRuntimeReference requires positive finite metadata size',
    )
  }

  for (const [name, value] of [
    ['duration', artifactEnvelope.metadata.duration],
    ['width', artifactEnvelope.metadata.width],
    ['height', artifactEnvelope.metadata.height],
  ] as const) {
    if (value !== undefined && !isPositiveFiniteNumber(value)) {
      throw new Error(
        `ArtifactRuntimeReference requires positive finite metadata ${name}`,
      )
    }
  }

  const metadata: ArtifactRuntimeMetadata = Object.freeze({
    mimeType: artifactEnvelope.metadata.mimeType,
    size: artifactEnvelope.metadata.size,
    ...(artifactEnvelope.metadata.duration === undefined
      ? {}
      : { duration: artifactEnvelope.metadata.duration }),
    ...(artifactEnvelope.metadata.width === undefined
      ? {}
      : { width: artifactEnvelope.metadata.width }),
    ...(artifactEnvelope.metadata.height === undefined
      ? {}
      : { height: artifactEnvelope.metadata.height }),
  })

  return Object.freeze({
    artifactId: artifactEnvelope.artifactId,
    artifactType: artifactEnvelope.artifactType,
    location: Object.freeze({
      type: artifactEnvelope.location.type,
      path: artifactEnvelope.location.path,
    }),
    metadata,
  })
}
