import type { ArtifactRuntimeReference } from './artifactRuntimeReference'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function isArtifactRuntimeReference(
  candidate: unknown,
): candidate is ArtifactRuntimeReference {
  if (
    !isRecord(candidate) ||
    !Object.isFrozen(candidate) ||
    !hasOnlyKeys(candidate, [
      'artifactId',
      'artifactType',
      'location',
      'metadata',
    ]) ||
    !isNonEmptyString(candidate.artifactId) ||
    candidate.artifactType !== 'video'
  ) {
    return false
  }

  const location = candidate.location
  if (
    !isRecord(location) ||
    !Object.isFrozen(location) ||
    !hasOnlyKeys(location, ['type', 'path']) ||
    location.type !== 'local-file' ||
    !isNonEmptyString(location.path)
  ) {
    return false
  }

  const metadata = candidate.metadata
  if (
    !isRecord(metadata) ||
    !Object.isFrozen(metadata) ||
    !hasOnlyKeys(metadata, [
      'mimeType',
      'size',
      'duration',
      'width',
      'height',
    ]) ||
    metadata.mimeType !== 'video/mp4' ||
    !isPositiveFiniteNumber(metadata.size)
  ) {
    return false
  }

  return ['duration', 'width', 'height'].every(
    (key) =>
      metadata[key] === undefined ||
      isPositiveFiniteNumber(metadata[key]),
  )
}
