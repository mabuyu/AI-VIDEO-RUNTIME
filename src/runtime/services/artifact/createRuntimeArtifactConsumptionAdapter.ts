import type { ArtifactRuntimeReference } from '../../../artifacts/runtime'
import { createRuntimeArtifactConsumer } from './createRuntimeArtifactConsumer'
import {
  createRuntimeArtifactConsumptionFailure,
  createRuntimeArtifactIssue,
} from './runtimeArtifactResult'
import type {
  RuntimeArtifactConsumer,
  RuntimeArtifactConsumptionAdapter,
  RuntimeArtifactConsumptionIssue,
  RuntimeArtifactConsumptionResult,
  RuntimeArtifactInput,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isConsumptionIssue(
  candidate: unknown,
): candidate is RuntimeArtifactConsumptionIssue {
  if (!isRecord(candidate)) return false

  return (
    [
      'UNSUPPORTED_ARTIFACT_TYPE',
      'UNSUPPORTED_LOCATION_TYPE',
      'RESOLUTION_FAILED',
      'CONSUMPTION_FAILED',
    ].includes(String(candidate.code)) && isNonEmptyString(candidate.message)
  )
}

function isCompleteRuntimeArtifactInput(
  candidate: unknown,
): candidate is RuntimeArtifactInput {
  if (
    !isRecord(candidate) ||
    !isNonEmptyString(candidate.artifactId) ||
    candidate.artifactType !== 'video'
  ) {
    return false
  }

  const resource = candidate.resource
  if (
    !isRecord(resource) ||
    resource.type !== 'runtime-video-source' ||
    !isNonEmptyString(resource.source)
  ) {
    return false
  }

  const metadata = candidate.metadata
  if (
    !isRecord(metadata) ||
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

function copyInput(input: RuntimeArtifactInput): RuntimeArtifactInput {
  return Object.freeze({
    artifactId: input.artifactId,
    artifactType: input.artifactType,
    resource: Object.freeze({
      type: input.resource.type,
      source: input.resource.source,
    }),
    metadata: Object.freeze({
      mimeType: input.metadata.mimeType,
      size: input.metadata.size,
      ...(input.metadata.duration === undefined
        ? {}
        : { duration: input.metadata.duration }),
      ...(input.metadata.width === undefined
        ? {}
        : { width: input.metadata.width }),
      ...(input.metadata.height === undefined
        ? {}
        : { height: input.metadata.height }),
    }),
  })
}

function invalidConsumerResult(): RuntimeArtifactConsumptionResult {
  return createRuntimeArtifactConsumptionFailure([
    createRuntimeArtifactIssue(
      'CONSUMPTION_FAILED',
      'Runtime Artifact Consumer returned no complete consumable input',
    ),
  ])
}

export function createRuntimeArtifactConsumptionAdapter():
  RuntimeArtifactConsumptionAdapter
export function createRuntimeArtifactConsumptionAdapter(
  consumer: RuntimeArtifactConsumer = createRuntimeArtifactConsumer(),
): RuntimeArtifactConsumptionAdapter {
  return Object.freeze({
    async consume(
      reference: ArtifactRuntimeReference,
    ): Promise<RuntimeArtifactConsumptionResult> {
      let result: unknown

      try {
        result = await consumer.consume(reference)
      } catch {
        return createRuntimeArtifactConsumptionFailure([
          createRuntimeArtifactIssue(
            'CONSUMPTION_FAILED',
            'Runtime Artifact Consumer failed to consume the reference',
          ),
        ])
      }

      if (!isRecord(result) || typeof result.ok !== 'boolean') {
        return invalidConsumerResult()
      }

      if (result.ok === false) {
        if (
          !Array.isArray(result.issues) ||
          result.issues.length === 0 ||
          !result.issues.every(isConsumptionIssue)
        ) {
          return invalidConsumerResult()
        }

        return createRuntimeArtifactConsumptionFailure(result.issues)
      }

      if (!isCompleteRuntimeArtifactInput(result.input)) {
        return invalidConsumerResult()
      }

      return Object.freeze({
        ok: true,
        input: copyInput(result.input),
      })
    },
  })
}
