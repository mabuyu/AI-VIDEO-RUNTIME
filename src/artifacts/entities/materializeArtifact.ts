import type { ArtifactCandidate } from '../contracts/artifactCandidate'
import type {
  ArtifactMaterializationIssue,
  ArtifactMaterializationResult,
} from './artifactMaterialization'
import type { ProductionArtifact } from './productionArtifact'
import { createAuthorizedCreatedProductionArtifactSnapshot } from './productionArtifactSnapshot'

const ARTIFACT_CANDIDATE_KEYS: readonly string[] = Object.freeze([
  'candidateId',
  'generationOutputId',
  'generationResultId',
  'providerId',
  'outputReference',
  'mediaType',
  'format',
  'sourceMetadata',
])
const SOURCE_METADATA_KEYS: readonly string[] = Object.freeze([
  'taskId',
  'providerTaskId',
])

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

function freezeIssues(
  issues: readonly ArtifactMaterializationIssue[],
): readonly ArtifactMaterializationIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ArtifactMaterializationIssue[],
): ArtifactMaterializationResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

export function materializeArtifact(
  candidate: ArtifactCandidate,
): ArtifactMaterializationResult {
  const value: unknown = candidate

  if (!isRecord(value) || !hasExactKeys(value, ARTIFACT_CANDIDATE_KEYS)) {
    return failure([
      {
        code: 'INVALID_ARTIFACT_CANDIDATE',
        message: 'Artifact materialization requires an exact ArtifactCandidate',
      },
    ])
  }

  const issues: ArtifactMaterializationIssue[] = []

  if (!isBoundaryString(value.candidateId)) {
    issues.push({
      code: 'INVALID_CANDIDATE_ID',
      message: 'ArtifactCandidate requires a stable non-empty candidateId',
      path: 'candidateId',
    })
  }

  if (!isBoundaryString(value.generationOutputId)) {
    issues.push({
      code: 'INVALID_GENERATION_OUTPUT_ID',
      message: 'ArtifactCandidate requires a non-empty generationOutputId',
      path: 'generationOutputId',
    })
  }

  if (!isBoundaryString(value.generationResultId)) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT_ID',
      message: 'ArtifactCandidate requires a non-empty generationResultId',
      path: 'generationResultId',
    })
  }

  if (!isBoundaryString(value.providerId)) {
    issues.push({
      code: 'INVALID_PROVIDER_ID',
      message: 'ArtifactCandidate requires a non-empty providerId',
      path: 'providerId',
    })
  }

  if (!isBoundaryString(value.outputReference)) {
    issues.push({
      code: 'INVALID_OUTPUT_REFERENCE',
      message: 'ArtifactCandidate requires a non-empty outputReference',
      path: 'outputReference',
    })
  }

  if (value.mediaType !== 'video') {
    issues.push({
      code: 'INVALID_MEDIA_TYPE',
      message: 'ArtifactCandidate mediaType must be video',
      path: 'mediaType',
    })
  }

  if (!isBoundaryString(value.format)) {
    issues.push({
      code: 'INVALID_FORMAT',
      message: 'ArtifactCandidate requires a non-empty media format',
      path: 'format',
    })
  }

  const sourceMetadata = value.sourceMetadata
  if (
    !isRecord(sourceMetadata) ||
    !hasExactKeys(sourceMetadata, SOURCE_METADATA_KEYS) ||
    !isBoundaryString(sourceMetadata.taskId) ||
    !isBoundaryString(sourceMetadata.providerTaskId)
  ) {
    issues.push({
      code: 'INVALID_SOURCE_METADATA',
      message:
        'ArtifactCandidate sourceMetadata requires only taskId and providerTaskId',
      path: 'sourceMetadata',
    })
  }

  if (issues.length > 0) return failure(issues)

  const candidateId = value.candidateId as string
  const generationOutputId = value.generationOutputId as string
  const generationResultId = value.generationResultId as string
  const providerId = value.providerId as string
  const validSourceMetadata = sourceMetadata as Record<string, unknown>
  const providerTaskId = validSourceMetadata.providerTaskId as string
  const provenanceIssues: ArtifactMaterializationIssue[] = []

  if (candidateId !== `artifact-candidate:${generationOutputId}`) {
    provenanceIssues.push({
      code: 'INVALID_CANDIDATE_ID',
      message: 'ArtifactCandidate candidateId does not match generationOutputId',
      path: 'candidateId',
    })
  }

  if (generationOutputId !== `generation-output:${providerId}:${providerTaskId}`) {
    provenanceIssues.push({
      code: 'INVALID_GENERATION_OUTPUT_ID',
      message: 'ArtifactCandidate generationOutputId does not match provenance',
      path: 'generationOutputId',
    })
  }

  if (generationResultId !== `generation-result:${providerId}:${providerTaskId}`) {
    provenanceIssues.push({
      code: 'INVALID_GENERATION_RESULT_ID',
      message: 'ArtifactCandidate generationResultId does not match provenance',
      path: 'generationResultId',
    })
  }

  if (provenanceIssues.length > 0) return failure(provenanceIssues)

  const artifact: ProductionArtifact =
    createAuthorizedCreatedProductionArtifactSnapshot({
      artifactId: `artifact:${candidateId}`,
      candidateId,
      generationOutputId,
      generationResultId,
      providerId,
      outputReference: value.outputReference as string,
      mediaType: 'video',
      format: value.format as string,
      sourceMetadata: {
        taskId: validSourceMetadata.taskId as string,
        providerTaskId,
      },
    })

  return Object.freeze({
    ok: true,
    artifact,
  })
}
