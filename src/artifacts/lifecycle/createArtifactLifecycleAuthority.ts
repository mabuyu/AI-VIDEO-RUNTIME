import type {
  ProductionArtifact,
  ProductionArtifactStatus,
} from '../entities'
import {
  createAuthorizedTransitionedProductionArtifactSnapshot,
  isAuthorizedProductionArtifactSnapshot,
} from '../entities/productionArtifactSnapshot'
import type {
  ArtifactLifecycleAuthority,
  ArtifactLifecycleIssue,
  ArtifactLifecycleIssueCode,
  ArtifactLifecycleTransitionResult,
} from './artifactLifecycle'

const PRODUCTION_ARTIFACT_STATUSES: readonly ProductionArtifactStatus[] =
  Object.freeze(['CREATED', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED'])
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
const ALLOWED_TRANSITIONS: Readonly<
  Record<ProductionArtifactStatus, readonly ProductionArtifactStatus[]>
> = Object.freeze({
  CREATED: Object.freeze<ProductionArtifactStatus[]>(['PROCESSING']),
  PROCESSING: Object.freeze<ProductionArtifactStatus[]>(['READY', 'FAILED']),
  READY: Object.freeze<ProductionArtifactStatus[]>(['ARCHIVED']),
  FAILED: Object.freeze<ProductionArtifactStatus[]>(['ARCHIVED']),
  ARCHIVED: Object.freeze<ProductionArtifactStatus[]>([]),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value)
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
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
  status: unknown,
): status is ProductionArtifactStatus {
  return PRODUCTION_ARTIFACT_STATUSES.some((candidate) => candidate === status)
}

function isProductionArtifactSnapshot(
  value: Record<string, unknown>,
): boolean {
  if (
    !hasExactKeys(value, PRODUCTION_ARTIFACT_KEYS) ||
    !Object.isFrozen(value) ||
    !isAuthorizedProductionArtifactSnapshot(value)
  ) {
    return false
  }

  const sourceMetadata = value.sourceMetadata
  if (
    !isRecord(sourceMetadata) ||
    !hasExactKeys(sourceMetadata, SOURCE_METADATA_KEYS) ||
    !Object.isFrozen(sourceMetadata)
  ) {
    return false
  }

  if (
    !isBoundaryString(value.artifactId) ||
    !isBoundaryString(value.candidateId) ||
    !isBoundaryString(value.generationOutputId) ||
    !isBoundaryString(value.generationResultId) ||
    !isBoundaryString(value.providerId) ||
    !isBoundaryString(value.outputReference) ||
    value.mediaType !== 'video' ||
    !isBoundaryString(value.format) ||
    !isProductionArtifactStatus(value.status) ||
    !isBoundaryString(sourceMetadata.taskId) ||
    !isBoundaryString(sourceMetadata.providerTaskId)
  ) {
    return false
  }

  return (
    value.artifactId === `artifact:${value.candidateId}` &&
    value.candidateId === `artifact-candidate:${value.generationOutputId}` &&
    value.generationOutputId ===
      `generation-output:${value.providerId}:${sourceMetadata.providerTaskId}` &&
    value.generationResultId ===
      `generation-result:${value.providerId}:${sourceMetadata.providerTaskId}`
  )
}

function failure(
  code: ArtifactLifecycleIssueCode,
  message: string,
): ArtifactLifecycleTransitionResult {
  const issue: ArtifactLifecycleIssue = Object.freeze({ code, message })
  return Object.freeze({
    ok: false,
    issues: Object.freeze([issue]),
  })
}

export function createArtifactLifecycleAuthority(): ArtifactLifecycleAuthority {
  return Object.freeze({
    transition(
      artifact: ProductionArtifact,
      targetStatus: ProductionArtifactStatus,
    ): ArtifactLifecycleTransitionResult {
      const value: unknown = artifact

      if (!isRecord(value)) {
        return failure(
          'INVALID_ARTIFACT',
          'Artifact lifecycle transition requires a ProductionArtifact',
        )
      }

      if (!isProductionArtifactStatus(value.status)) {
        return failure(
          'INVALID_CURRENT_STATUS',
          `Unsupported ProductionArtifact current status: ${String(value.status)}`,
        )
      }

      if (!isProductionArtifactSnapshot(value)) {
        return failure(
          'INVALID_ARTIFACT',
          'Artifact lifecycle transition requires an immutable valid ProductionArtifact',
        )
      }

      if (!isProductionArtifactStatus(targetStatus)) {
        return failure(
          'INVALID_TARGET_STATUS',
          `Unsupported ProductionArtifact target status: ${String(targetStatus)}`,
        )
      }

      if (!ALLOWED_TRANSITIONS[value.status].includes(targetStatus)) {
        return failure(
          'INVALID_TRANSITION',
          `ProductionArtifact transition ${value.status} -> ${targetStatus} is not allowed`,
        )
      }

      const transitionedArtifact =
        createAuthorizedTransitionedProductionArtifactSnapshot(
        artifact,
        targetStatus,
      )

      if (transitionedArtifact === undefined) {
        return failure(
          'INVALID_ARTIFACT',
          'Artifact lifecycle snapshot authorization was rejected',
        )
      }

      return Object.freeze({
        ok: true,
        artifact: transitionedArtifact,
      })
    },
  })
}
