import type {
  ProductionArtifact,
  ProductionArtifactStatus,
} from '../entities'
import {
  createAuthorizedRehydratedProductionArtifactSnapshot,
  isAuthorizedProductionArtifactSnapshot,
} from '../entities/productionArtifactSnapshot'
import type {
  ArtifactRepository,
  ProductionArtifactRecord,
} from './artifactRepository'

const PRODUCTION_ARTIFACT_RECORD_KEYS: readonly string[] = Object.freeze([
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
const TRUSTED_REHYDRATION_ACCESS: object = Object.freeze({})

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

export function isProductionArtifactRecord(
  value: unknown,
): value is ProductionArtifactRecord {
  if (
    !isPlainRecord(value) ||
    !hasExactDataProperties(value, PRODUCTION_ARTIFACT_RECORD_KEYS)
  ) {
    return false
  }

  const sourceMetadata = value.sourceMetadata
  if (
    !isPlainRecord(sourceMetadata) ||
    !hasExactDataProperties(sourceMetadata, SOURCE_METADATA_KEYS)
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

function copyAsImmutableRecord(
  value: ProductionArtifact,
): ProductionArtifactRecord
function copyAsImmutableRecord(
  value: ProductionArtifactRecord,
): ProductionArtifactRecord
function copyAsImmutableRecord(
  value: ProductionArtifact | ProductionArtifactRecord,
): ProductionArtifactRecord {
  return Object.freeze({
    artifactId: value.artifactId,
    candidateId: value.candidateId,
    generationOutputId: value.generationOutputId,
    generationResultId: value.generationResultId,
    providerId: value.providerId,
    outputReference: value.outputReference,
    mediaType: value.mediaType,
    format: value.format,
    status: value.status,
    sourceMetadata: Object.freeze({
      taskId: value.sourceMetadata.taskId,
      providerTaskId: value.sourceMetadata.providerTaskId,
    }),
  })
}

function createRecord(artifact: ProductionArtifact): ProductionArtifactRecord {
  const value: unknown = artifact
  if (
    !isPlainRecord(value) ||
    !isAuthorizedProductionArtifactSnapshot(value)
  ) {
    throw new TypeError(
      'ArtifactRepository can only save an authorized ProductionArtifact',
    )
  }

  const record = copyAsImmutableRecord(artifact)
  if (!isProductionArtifactRecord(record)) {
    throw new TypeError(
      'ArtifactRepository cannot persist an invalid ProductionArtifactRecord',
    )
  }

  return record
}

export function rehydrateProductionArtifact(
  record: unknown,
  access: object,
): ProductionArtifact {
  if (!isProductionArtifactRecord(record)) {
    throw new TypeError(
      'ArtifactRepository rejected an invalid ProductionArtifactRecord',
    )
  }

  if (access !== TRUSTED_REHYDRATION_ACCESS) {
    throw new TypeError(
      'ProductionArtifact rehydration requires trusted repository access',
    )
  }

  return createAuthorizedRehydratedProductionArtifactSnapshot({
    artifactId: record.artifactId,
    candidateId: record.candidateId,
    generationOutputId: record.generationOutputId,
    generationResultId: record.generationResultId,
    providerId: record.providerId,
    outputReference: record.outputReference,
    mediaType: record.mediaType,
    format: record.format,
    status: record.status,
    sourceMetadata: {
      taskId: record.sourceMetadata.taskId,
      providerTaskId: record.sourceMetadata.providerTaskId,
    },
  })
}

/** Map-backed reference implementation for boundary validation, not production persistence. */
export function createInMemoryArtifactRepository(): ArtifactRepository {
  const records = new Map<string, ProductionArtifactRecord>()

  return Object.freeze({
    async save(artifact: ProductionArtifact): Promise<void> {
      const record = createRecord(artifact)
      records.set(record.artifactId, record)
    },

    async getById(artifactId: string): Promise<ProductionArtifact | null> {
      const storedRecord = records.get(artifactId)
      if (storedRecord === undefined) return null

      const recordCopy = copyAsImmutableRecord(storedRecord)
      return rehydrateProductionArtifact(
        recordCopy,
        TRUSTED_REHYDRATION_ACCESS,
      )
    },

    async exists(artifactId: string): Promise<boolean> {
      return records.has(artifactId)
    },
  })
}
