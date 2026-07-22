import type { ArtifactRuntimeReference } from '../../../artifacts/runtime'
import { createRuntimeArtifactResolver } from './createRuntimeArtifactResolver'
import {
  createRuntimeArtifactConsumptionFailure,
  createRuntimeArtifactIssue,
} from './runtimeArtifactResult'
import type {
  RuntimeArtifactConsumer,
  RuntimeArtifactInput,
  RuntimeArtifactInputMetadata,
  RuntimeArtifactResolver,
} from './types'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function hasConsumableMetadata(reference: ArtifactRuntimeReference): boolean {
  const { metadata } = reference

  if (
    metadata === null ||
    typeof metadata !== 'object' ||
    metadata.mimeType !== 'video/mp4' ||
    !isPositiveFiniteNumber(metadata.size)
  ) {
    return false
  }

  return [metadata.duration, metadata.width, metadata.height].every(
    (value) => value === undefined || isPositiveFiniteNumber(value),
  )
}

function createMetadata(
  reference: ArtifactRuntimeReference,
): RuntimeArtifactInputMetadata {
  const { metadata } = reference

  return Object.freeze({
    mimeType: metadata.mimeType,
    size: metadata.size,
    ...(metadata.duration === undefined ? {} : { duration: metadata.duration }),
    ...(metadata.width === undefined ? {} : { width: metadata.width }),
    ...(metadata.height === undefined ? {} : { height: metadata.height }),
  })
}

export function createRuntimeArtifactConsumer(): RuntimeArtifactConsumer
export function createRuntimeArtifactConsumer(
  resolver: RuntimeArtifactResolver = createRuntimeArtifactResolver(),
): RuntimeArtifactConsumer {
  return Object.freeze({
    async consume(reference: ArtifactRuntimeReference) {
      if (reference === null || typeof reference !== 'object') {
        return createRuntimeArtifactConsumptionFailure([
          createRuntimeArtifactIssue(
            'CONSUMPTION_FAILED',
            'Runtime Artifact Reference is not consumable',
          ),
        ])
      }

      if (reference.artifactType !== 'video') {
        return createRuntimeArtifactConsumptionFailure([
          createRuntimeArtifactIssue(
            'UNSUPPORTED_ARTIFACT_TYPE',
            'Runtime Artifact Consumer supports only video artifacts',
          ),
        ])
      }

      if (
        reference.location === null ||
        typeof reference.location !== 'object' ||
        reference.location.type !== 'local-file'
      ) {
        return createRuntimeArtifactConsumptionFailure([
          createRuntimeArtifactIssue(
            'UNSUPPORTED_LOCATION_TYPE',
            'Runtime Artifact Consumer supports only local-file locations',
          ),
        ])
      }

      if (!isNonEmptyString(reference.artifactId) || !hasConsumableMetadata(reference)) {
        return createRuntimeArtifactConsumptionFailure([
          createRuntimeArtifactIssue(
            'CONSUMPTION_FAILED',
            'Runtime Artifact Reference is not consumable',
          ),
        ])
      }

      let resolved
      try {
        resolved = await resolver.resolve(reference.location, reference.artifactType)
      } catch {
        return createRuntimeArtifactConsumptionFailure([
          createRuntimeArtifactIssue(
            'RESOLUTION_FAILED',
            'Runtime Artifact resource resolution failed',
          ),
        ])
      }

      if (!resolved.ok) {
        return createRuntimeArtifactConsumptionFailure(resolved.issues)
      }

      if (
        resolved.resource.type !== 'runtime-video-source' ||
        !isNonEmptyString(resolved.resource.source)
      ) {
        return createRuntimeArtifactConsumptionFailure([
          createRuntimeArtifactIssue(
            'CONSUMPTION_FAILED',
            'Runtime Artifact Resolver returned no consumable resource',
          ),
        ])
      }

      const input: RuntimeArtifactInput = Object.freeze({
        artifactId: reference.artifactId,
        artifactType: reference.artifactType,
        resource: Object.freeze({
          type: resolved.resource.type,
          source: resolved.resource.source,
        }),
        metadata: createMetadata(reference),
      })

      return Object.freeze({ ok: true, input })
    },
  })
}
