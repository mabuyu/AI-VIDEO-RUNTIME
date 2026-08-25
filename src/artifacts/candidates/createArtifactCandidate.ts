import type {
  ArtifactCandidate,
  ArtifactIngestionIssue,
  ArtifactIngestionResult,
} from '../contracts'

const GENERATION_OUTPUT_KEYS = Object.freeze([
  'id',
  'generationResultId',
  'providerId',
  'outputReference',
  'metadata',
])
const GENERATION_OUTPUT_METADATA_KEYS = Object.freeze([
  'mediaType',
  'format',
  'taskId',
  'providerTaskId',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key))
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
  issues: readonly ArtifactIngestionIssue[],
): readonly ArtifactIngestionIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ArtifactIngestionIssue[],
): ArtifactIngestionResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

function createCandidate(
  generationOutputId: string,
  generationResultId: string,
  providerId: string,
  outputReference: string,
  mediaType: 'video',
  format: string,
  taskId: string,
  providerTaskId: string,
): ArtifactCandidate {
  return Object.freeze({
    candidateId: `artifact-candidate:${generationOutputId}`,
    generationOutputId,
    generationResultId,
    providerId,
    outputReference,
    mediaType,
    format,
    sourceMetadata: Object.freeze({
      taskId,
      providerTaskId,
    }),
  })
}

export function createArtifactCandidate(
  output: unknown,
): ArtifactIngestionResult {
  if (!isRecord(output)) {
    return failure([
      {
        code: 'INVALID_GENERATION_OUTPUT',
        message: 'Artifact ingestion requires a GenerationOutput object',
      },
    ])
  }

  if (!hasOnlyKeys(output, GENERATION_OUTPUT_KEYS)) {
    return failure([
      {
        code: 'INVALID_GENERATION_OUTPUT',
        message: 'GenerationOutput contains fields outside its contract',
      },
    ])
  }

  const issues: ArtifactIngestionIssue[] = []

  if (!isBoundaryString(output.id)) {
    issues.push({
      code: 'INVALID_GENERATION_OUTPUT_ID',
      message: 'GenerationOutput requires a stable non-empty id',
      path: 'id',
    })
  }

  if (!isBoundaryString(output.generationResultId)) {
    issues.push({
      code: 'INVALID_GENERATION_RESULT_ID',
      message: 'GenerationOutput requires a non-empty generationResultId',
      path: 'generationResultId',
    })
  }

  if (!isBoundaryString(output.providerId)) {
    issues.push({
      code: 'INVALID_PROVIDER_ID',
      message: 'GenerationOutput requires a non-empty providerId',
      path: 'providerId',
    })
  }

  if (!isBoundaryString(output.outputReference)) {
    issues.push({
      code: 'INVALID_OUTPUT_REFERENCE',
      message: 'GenerationOutput requires a non-empty outputReference',
      path: 'outputReference',
    })
  }

  const metadata = output.metadata
  if (
    !isRecord(metadata) ||
    !hasOnlyKeys(metadata, GENERATION_OUTPUT_METADATA_KEYS)
  ) {
    issues.push({
      code: 'INVALID_SOURCE_METADATA',
      message: 'GenerationOutput requires boundary-safe source metadata',
      path: 'metadata',
    })
  } else {
    if (metadata.mediaType !== 'video') {
      issues.push({
        code: 'INVALID_MEDIA_TYPE',
        message: 'GenerationOutput mediaType must be video',
        path: 'metadata.mediaType',
      })
    }

    if (!isBoundaryString(metadata.format)) {
      issues.push({
        code: 'INVALID_FORMAT',
        message: 'GenerationOutput requires a non-empty media format',
        path: 'metadata.format',
      })
    }

    if (
      !isBoundaryString(metadata.taskId) ||
      !isBoundaryString(metadata.providerTaskId)
    ) {
      issues.push({
        code: 'INVALID_SOURCE_METADATA',
        message:
          'GenerationOutput source metadata requires taskId and providerTaskId',
        path: 'metadata',
      })
    }
  }

  if (issues.length > 0) return failure(issues)

  const generationOutputId = output.id as string
  const generationResultId = output.generationResultId as string
  const providerId = output.providerId as string
  const outputReference = output.outputReference as string
  const validMetadata = metadata as Record<string, unknown>
  const providerTaskId = validMetadata.providerTaskId as string
  const expectedGenerationOutputId =
    `generation-output:${providerId}:${providerTaskId}`
  const expectedGenerationResultId =
    `generation-result:${providerId}:${providerTaskId}`
  const provenanceIssues: ArtifactIngestionIssue[] = []

  if (generationOutputId !== expectedGenerationOutputId) {
    provenanceIssues.push({
      code: 'INVALID_GENERATION_OUTPUT_ID',
      message: 'GenerationOutput id does not match its provider provenance',
      path: 'id',
    })
  }

  if (generationResultId !== expectedGenerationResultId) {
    provenanceIssues.push({
      code: 'INVALID_GENERATION_RESULT_ID',
      message:
        'GenerationOutput generationResultId does not match its provider provenance',
      path: 'generationResultId',
    })
  }

  if (provenanceIssues.length > 0) return failure(provenanceIssues)

  const candidate = createCandidate(
    generationOutputId,
    generationResultId,
    providerId,
    outputReference,
    validMetadata.mediaType as 'video',
    validMetadata.format as string,
    validMetadata.taskId as string,
    providerTaskId,
  )

  return Object.freeze({
    ok: true,
    candidate,
  })
}
