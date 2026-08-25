import type { ProductionArtifact, ProductionArtifactStatus } from '../entities'
import { isAuthorizedProductionArtifactSnapshot } from '../entities/productionArtifactSnapshot'

export interface ProductionArtifactRuntimeReference {
  readonly artifactId: string
  readonly mediaType: 'video'
  readonly format: string
  readonly resourceReference: string
}

export type ProductionArtifactRuntimePublicationIssueCode =
  | 'INVALID_PRODUCTION_ARTIFACT'
  | 'UNTRUSTED_PRODUCTION_ARTIFACT'
  | 'ARTIFACT_NOT_READY'
  | 'INVALID_ARTIFACT_PROVENANCE'
  | 'INVALID_RESOURCE_REFERENCE'

export interface ProductionArtifactRuntimePublicationIssue {
  readonly code: ProductionArtifactRuntimePublicationIssueCode
  readonly message: string
  readonly path?: string
}

export type ProductionArtifactRuntimePublicationResult =
  | {
      readonly ok: true
      readonly reference: ProductionArtifactRuntimeReference
    }
  | {
      readonly ok: false
      readonly issues: readonly ProductionArtifactRuntimePublicationIssue[]
    }

export interface ArtifactRuntimePublicationBoundary {
  readonly publish: (
    artifact: ProductionArtifact,
  ) => ProductionArtifactRuntimePublicationResult
}

const PRODUCTION_ARTIFACT_KEYS: readonly string[] = Object.freeze([
  'artifactId',
  'candidateId',
  'generationOutputId',
  'generationResultId',
  'providerId',
  'outputReference',
  'mediaType',
  'format',
  'status',
  'sourceMetadata',
])
const SOURCE_METADATA_KEYS: readonly string[] = Object.freeze([
  'taskId',
  'providerTaskId',
])
const PRODUCTION_ARTIFACT_STATUSES: readonly ProductionArtifactStatus[] =
  Object.freeze(['CREATED', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED'])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactDataProperties(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Reflect.ownKeys(value)
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key) => typeof key === 'string' && expectedKeys.includes(key),
    ) &&
    expectedKeys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return (
        descriptor !== undefined &&
        descriptor.enumerable === true &&
        'value' in descriptor
      )
    })
  )
}

function isBoundaryString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
    })
  )
}

function isProductionArtifactStatus(
  value: unknown,
): value is ProductionArtifactStatus {
  return PRODUCTION_ARTIFACT_STATUSES.some((status) => status === value)
}

function hasProductionArtifactStructure(
  value: unknown,
): value is ProductionArtifact {
  if (
    !isPlainRecord(value) ||
    !hasExactDataProperties(value, PRODUCTION_ARTIFACT_KEYS) ||
    !Object.isFrozen(value)
  ) {
    return false
  }

  const sourceMetadata = value.sourceMetadata
  if (
    !isPlainRecord(sourceMetadata) ||
    !hasExactDataProperties(sourceMetadata, SOURCE_METADATA_KEYS) ||
    !Object.isFrozen(sourceMetadata)
  ) {
    return false
  }

  return (
    isBoundaryString(value.artifactId) &&
    isBoundaryString(value.candidateId) &&
    isBoundaryString(value.generationOutputId) &&
    isBoundaryString(value.generationResultId) &&
    isBoundaryString(value.providerId) &&
    typeof value.outputReference === 'string' &&
    value.mediaType === 'video' &&
    isBoundaryString(value.format) &&
    isProductionArtifactStatus(value.status) &&
    isBoundaryString(sourceMetadata.taskId) &&
    isBoundaryString(sourceMetadata.providerTaskId)
  )
}

function hasValidProvenance(artifact: ProductionArtifact): boolean {
  return (
    artifact.artifactId === `artifact:${artifact.candidateId}` &&
    artifact.candidateId ===
      `artifact-candidate:${artifact.generationOutputId}` &&
    artifact.generationOutputId ===
      `generation-output:${artifact.providerId}:${artifact.sourceMetadata.providerTaskId}` &&
    artifact.generationResultId ===
      `generation-result:${artifact.providerId}:${artifact.sourceMetadata.providerTaskId}`
  )
}

function failure(
  issue: ProductionArtifactRuntimePublicationIssue,
): ProductionArtifactRuntimePublicationResult {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ ...issue })]),
  })
}

export function createArtifactRuntimePublicationBoundary(): ArtifactRuntimePublicationBoundary {
  return Object.freeze({
    publish(
      artifact: ProductionArtifact,
    ): ProductionArtifactRuntimePublicationResult {
      const value: unknown = artifact

      if (!hasProductionArtifactStructure(value)) {
        return failure({
          code: 'INVALID_PRODUCTION_ARTIFACT',
          message:
            'Runtime publication requires an immutable valid ProductionArtifact',
        })
      }

      if (!isAuthorizedProductionArtifactSnapshot(value)) {
        return failure({
          code: 'UNTRUSTED_PRODUCTION_ARTIFACT',
          message:
            'Runtime publication requires trusted ProductionArtifact provenance',
        })
      }

      if (value.status !== 'READY') {
        return failure({
          code: 'ARTIFACT_NOT_READY',
          message: 'Runtime publication requires ProductionArtifact status READY',
          path: 'status',
        })
      }

      if (!hasValidProvenance(value)) {
        return failure({
          code: 'INVALID_ARTIFACT_PROVENANCE',
          message:
            'Runtime publication rejected inconsistent Artifact identity or provenance',
        })
      }

      if (!isBoundaryString(value.outputReference)) {
        return failure({
          code: 'INVALID_RESOURCE_REFERENCE',
          message:
            'Runtime publication requires a valid opaque resource reference',
          path: 'outputReference',
        })
      }

      const reference: ProductionArtifactRuntimeReference = Object.freeze({
        artifactId: value.artifactId,
        mediaType: value.mediaType,
        format: value.format,
        resourceReference: value.outputReference,
      })

      return Object.freeze({
        ok: true,
        reference,
      })
    },
  })
}
