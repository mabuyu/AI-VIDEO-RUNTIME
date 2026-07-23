import type { ArtifactEnvelope } from '../contracts'
import { validateArtifactEnvelope } from '../contracts'
import {
  consumeVideoReferenceToArtifact,
  type VideoArtifactConsumerResult,
  type VideoArtifactSource,
} from '../consumers/videoReferenceConsumer'
import type {
  ArtifactCandidate,
  ArtifactIngestionIssue,
  ArtifactIngestionPort,
  ArtifactIngestionRequest,
  ArtifactIngestionResult,
} from './types/artifactIngestion'
import {
  validateArtifactIngestionRequest,
  validateArtifactIngestionResult,
} from './validation/validateArtifactIngestion'

export type VideoArtifactConsumer = (
  videoReference: {
    readonly referenceType: 'provider-video'
    readonly reference: string
  },
  source: VideoArtifactSource,
) => Promise<VideoArtifactConsumerResult>

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

function metadataString(
  request: ArtifactIngestionRequest,
  key: string,
): string | undefined {
  const value = request.sourceReference.metadata?.[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function createCandidate(
  request: ArtifactIngestionRequest,
): ArtifactCandidate {
  return Object.freeze({
    candidateId: request.ingestionId,
    sourceReference: request.sourceReference,
    productionContext: request.productionContext,
  })
}

function isManagedReadyArtifact(value: unknown): value is ArtifactEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const artifact = value as ArtifactEnvelope
  return (
    artifact.status === 'READY' &&
    validateArtifactEnvelope(artifact).valid
  )
}

export function createVideoArtifactIngestionPort(
  consumer: VideoArtifactConsumer = consumeVideoReferenceToArtifact,
): ArtifactIngestionPort {
  return Object.freeze({
    async ingest(
      request: ArtifactIngestionRequest,
    ): Promise<ArtifactIngestionResult> {
      const validation = validateArtifactIngestionRequest(request)
      if (!validation.valid) return failure(validation.issues)

      const provider = metadataString(request, 'provider')
      const model = metadataString(request, 'model')
      const generationId = metadataString(request, 'generationId')
      if (
        provider === undefined ||
        model === undefined ||
        generationId === undefined
      ) {
        return failure([
          {
            code: 'INVALID_SOURCE_REFERENCE',
            message:
              'Artifact ingestion requires provider, model, and generationId source metadata',
            path: 'sourceReference.metadata',
          },
        ])
      }

      const candidate = createCandidate(request)
      let consumerResult: VideoArtifactConsumerResult
      try {
        consumerResult = await consumer(
          {
            referenceType: 'provider-video',
            reference: candidate.sourceReference.location,
          },
          { provider, model, generationId },
        )
      } catch {
        return failure([
          {
            code: 'ARTIFACT_CONSUMER_FAILED',
            message: 'Artifact Consumer failed during ingestion',
          },
        ])
      }

      if (!consumerResult.success) {
        return failure(consumerResult.issues)
      }

      if (!isManagedReadyArtifact(consumerResult.artifact)) {
        return failure([
          {
            code: 'INVALID_ARTIFACT_CONSUMER_RESULT',
            message:
              'Artifact Consumer did not return a valid managed READY Artifact',
          },
        ])
      }

      const result: ArtifactIngestionResult = Object.freeze({
        ok: true,
        candidateId: candidate.candidateId,
      })
      const resultValidation = validateArtifactIngestionResult(result)
      return resultValidation.valid ? result : failure(resultValidation.issues)
    },
  })
}
