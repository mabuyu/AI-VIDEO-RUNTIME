import type {
  ProductionArtifact,
  ProductionArtifactStatus,
} from './productionArtifact'

const authorizedProductionArtifactSnapshots = new WeakSet<object>()
const ALLOWED_TRANSITIONS: Readonly<
  Record<ProductionArtifactStatus, readonly ProductionArtifactStatus[]>
> = Object.freeze({
  CREATED: Object.freeze<ProductionArtifactStatus[]>(['PROCESSING']),
  PROCESSING: Object.freeze<ProductionArtifactStatus[]>(['READY', 'FAILED']),
  READY: Object.freeze<ProductionArtifactStatus[]>(['ARCHIVED']),
  FAILED: Object.freeze<ProductionArtifactStatus[]>(['ARCHIVED']),
  ARCHIVED: Object.freeze<ProductionArtifactStatus[]>([]),
})

type CreatedProductionArtifactInput = Omit<ProductionArtifact, 'status'>

function authorizeProductionArtifactSnapshot(
  artifact: ProductionArtifact,
): ProductionArtifact {
  const snapshot: ProductionArtifact = Object.freeze({
    artifactId: artifact.artifactId,
    candidateId: artifact.candidateId,
    generationOutputId: artifact.generationOutputId,
    generationResultId: artifact.generationResultId,
    providerId: artifact.providerId,
    outputReference: artifact.outputReference,
    mediaType: artifact.mediaType,
    format: artifact.format,
    status: artifact.status,
    sourceMetadata: Object.freeze({
      taskId: artifact.sourceMetadata.taskId,
      providerTaskId: artifact.sourceMetadata.providerTaskId,
    }),
  })

  authorizedProductionArtifactSnapshots.add(snapshot)
  return snapshot
}

export function createAuthorizedCreatedProductionArtifactSnapshot(
  artifact: CreatedProductionArtifactInput,
): ProductionArtifact {
  return authorizeProductionArtifactSnapshot({
    ...artifact,
    status: 'CREATED',
  })
}

export function createAuthorizedRehydratedProductionArtifactSnapshot(
  artifact: ProductionArtifact,
): ProductionArtifact {
  return authorizeProductionArtifactSnapshot(artifact)
}

export function createAuthorizedTransitionedProductionArtifactSnapshot(
  artifact: ProductionArtifact,
  targetStatus: ProductionArtifactStatus,
): ProductionArtifact | undefined {
  if (
    !authorizedProductionArtifactSnapshots.has(artifact) ||
    !ALLOWED_TRANSITIONS[artifact.status].includes(targetStatus)
  ) {
    return undefined
  }

  return authorizeProductionArtifactSnapshot({
    ...artifact,
    status: targetStatus,
  })
}

export function isAuthorizedProductionArtifactSnapshot(
  value: object,
): value is ProductionArtifact {
  return authorizedProductionArtifactSnapshots.has(value)
}
