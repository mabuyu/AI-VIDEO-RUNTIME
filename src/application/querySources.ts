import type { ProductionArtifactRuntimeReference } from '../artifacts/runtime'
import type { ProductionJob } from '../jobs'
import type {
  ArtifactDeliveryQuerySource,
  ArtifactDeliveryRecord,
  ProductionJobAdmissionStore,
  ProductionJobQuerySource,
} from './contracts'

interface ProductionJobRepositoryPort {
  readonly save: (
    job: ProductionJob,
    expectedVersion: number | null,
  ) => boolean | Promise<boolean>
  readonly getById: (
    jobId: string,
  ) => ProductionJob | null | undefined | Promise<ProductionJob | null | undefined>
}

function deterministicJobId(requestId: string): string {
  return `production-job:production-plan:${requestId}`
}

export function createProductionJobQuerySource(
  repository: Pick<ProductionJobRepositoryPort, 'getById'>,
): ProductionJobQuerySource {
  return Object.freeze({
    getById(jobId: string) {
      return repository.getById(jobId)
    },
    findByRequestId(requestId: string) {
      return repository.getById(deterministicJobId(requestId))
    },
  })
}

export function createProductionJobApplicationStore(
  repository: ProductionJobRepositoryPort,
): ProductionJobAdmissionStore {
  return Object.freeze({
    save(job: ProductionJob, expectedVersion: number | null) {
      return repository.save(job, expectedVersion)
    },
    getById(jobId: string) {
      return repository.getById(jobId)
    },
    findByRequestId(requestId: string) {
      return repository.getById(deterministicJobId(requestId))
    },
  })
}

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function validReference(
  reference: ProductionArtifactRuntimeReference,
): boolean {
  return (
    typeof reference === 'object' &&
    reference !== null &&
    Object.isFrozen(reference) &&
    Object.keys(reference).length === 4 &&
    isBoundaryString(reference.artifactId) &&
    reference.mediaType === 'video' &&
    isBoundaryString(reference.format) &&
    isBoundaryString(reference.resourceReference)
  )
}

function snapshotDelivery(record: ArtifactDeliveryRecord): ArtifactDeliveryRecord {
  if (
    typeof record !== 'object' ||
    record === null ||
    !isBoundaryString(record.projectId) ||
    !isBoundaryString(record.requestId) ||
    !isBoundaryString(record.jobId) ||
    !validReference(record.reference)
  ) {
    throw new TypeError('Artifact delivery source requires a valid READY reference record')
  }
  return Object.freeze({
    projectId: record.projectId,
    requestId: record.requestId,
    jobId: record.jobId,
    reference: Object.freeze({
      artifactId: record.reference.artifactId,
      mediaType: record.reference.mediaType,
      format: record.reference.format,
      resourceReference: record.reference.resourceReference,
    }),
  })
}

export function createInMemoryArtifactDeliveryQuerySource(
  initialRecords: readonly ArtifactDeliveryRecord[] = [],
): ArtifactDeliveryQuerySource {
  const byJobId = new Map<string, ArtifactDeliveryRecord>()
  const byRequestId = new Map<string, ArtifactDeliveryRecord>()
  for (const candidate of initialRecords) {
    const record = snapshotDelivery(candidate)
    if (byJobId.has(record.jobId) || byRequestId.has(record.requestId)) {
      throw new TypeError('Artifact delivery source requires unique correlation')
    }
    byJobId.set(record.jobId, record)
    byRequestId.set(record.requestId, record)
  }

  return Object.freeze({
    getByJobId(jobId: string) {
      return byJobId.get(jobId)
    },
    findByRequestId(requestId: string) {
      return byRequestId.get(requestId)
    },
  })
}
