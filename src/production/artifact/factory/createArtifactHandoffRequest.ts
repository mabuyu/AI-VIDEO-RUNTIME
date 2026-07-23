import type {
  ProviderMetadataValue,
  VideoReference,
} from '../../provider'
import type {
  ArtifactHandoffIssue,
  ProductionArtifactHandoffRequest,
  ProductionArtifactHandoffRequestCreationResult,
} from '../types/artifactHandoff'
import { validateProductionArtifactHandoffRequest } from '../validation/validateArtifactHandoff'

function freezeIssues(
  issues: readonly ArtifactHandoffIssue[],
): readonly ArtifactHandoffIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ArtifactHandoffIssue[],
): ProductionArtifactHandoffRequestCreationResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

function freezeMetadataValue(
  value: ProviderMetadataValue,
): ProviderMetadataValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeMetadataValue))
  }

  if (typeof value === 'object' && value !== null) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          freezeMetadataValue(nestedValue),
        ]),
      ),
    )
  }

  return value
}

function freezeVideoReference(reference: VideoReference): VideoReference {
  const metadata =
    reference.metadata === undefined
      ? undefined
      : Object.freeze(
          Object.fromEntries(
            Object.entries(reference.metadata).map(([key, value]) => [
              key,
              freezeMetadataValue(value),
            ]),
          ),
        )

  return Object.freeze({
    referenceId: reference.referenceId,
    sourceType: reference.sourceType,
    location: reference.location,
    ...(metadata === undefined ? {} : { metadata }),
  })
}

export function createArtifactHandoffRequest(
  input: unknown,
): ProductionArtifactHandoffRequestCreationResult {
  const validation = validateProductionArtifactHandoffRequest(input)
  if (!validation.valid) {
    return failure(validation.issues)
  }

  const candidate = input as ProductionArtifactHandoffRequest
  const request: ProductionArtifactHandoffRequest = Object.freeze({
    handoffId: candidate.handoffId,
    productionJobId: candidate.productionJobId,
    productionAttemptId: candidate.productionAttemptId,
    videoReference: freezeVideoReference(candidate.videoReference),
  })

  return Object.freeze({
    ok: true,
    request,
  })
}
