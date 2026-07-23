import type {
  ArtifactIngestionIssue,
  ArtifactIngestionPort,
  ArtifactIngestionRequest,
  ArtifactIngestionResult,
} from '../../../artifacts/ingestion'
import {
  validateArtifactIngestionRequest,
  validateArtifactIngestionResult,
} from '../../../artifacts/ingestion'
import { createArtifactHandoffRequest } from '../factory/createArtifactHandoffRequest'
import type { ProductionArtifactHandoffRequest } from '../types/artifactHandoff'

export interface ProductionArtifactIngestionAdapter {
  ingest(
    request: ProductionArtifactHandoffRequest,
  ): Promise<ArtifactIngestionResult>
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

export function createArtifactIngestionAdapter(
  port: ArtifactIngestionPort,
): ProductionArtifactIngestionAdapter {
  return Object.freeze({
    async ingest(
      request: ProductionArtifactHandoffRequest,
    ): Promise<ArtifactIngestionResult> {
      const handoff = createArtifactHandoffRequest(request)
      if (!handoff.ok) return failure(handoff.issues)

      const ingestionRequest: ArtifactIngestionRequest = Object.freeze({
        ingestionId: handoff.request.handoffId,
        sourceReference: handoff.request.videoReference,
        productionContext: Object.freeze({
          productionJobId: handoff.request.productionJobId,
          productionAttemptId: handoff.request.productionAttemptId,
        }),
      })

      const requestValidation =
        validateArtifactIngestionRequest(ingestionRequest)
      if (!requestValidation.valid) return failure(requestValidation.issues)

      let result: unknown
      try {
        result = await port.ingest(ingestionRequest)
      } catch {
        return failure([
          {
            code: 'ARTIFACT_CONSUMER_FAILED',
            message: 'Artifact ingestion port rejected or failed the request',
          },
        ])
      }

      const resultValidation = validateArtifactIngestionResult(result)
      if (!resultValidation.valid) return failure(resultValidation.issues)

      if ((result as ArtifactIngestionResult).ok === true) {
        return Object.freeze({
          ok: true,
          candidateId: (
            result as Extract<ArtifactIngestionResult, { ok: true }>
          ).candidateId,
        })
      }

      return failure(
        (
          result as Extract<ArtifactIngestionResult, { ok: false }>
        ).issues,
      )
    },
  })
}
