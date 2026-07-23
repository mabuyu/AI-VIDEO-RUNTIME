import type {
  ArtifactConsumer,
  ArtifactHandoffIssue,
  ArtifactHandoffResult,
  ProductionArtifactHandoffRequest,
} from '../types/artifactHandoff'
import { createArtifactHandoffRequest } from '../factory/createArtifactHandoffRequest'
import { validateArtifactHandoffResult } from '../validation/validateArtifactHandoff'

function freezeIssues(
  issues: readonly ArtifactHandoffIssue[],
): readonly ArtifactHandoffIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ArtifactHandoffIssue[],
): ArtifactHandoffResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

export async function submitArtifactHandoff(
  request: ProductionArtifactHandoffRequest,
  consumer: ArtifactConsumer,
): Promise<ArtifactHandoffResult> {
  const creation = createArtifactHandoffRequest(request)
  if (!creation.ok) {
    return failure(creation.issues)
  }
  const canonicalRequest = creation.request

  let consumerResult: unknown
  try {
    consumerResult = await consumer.handoff(canonicalRequest)
  } catch {
    return failure([
      {
        code: 'ARTIFACT_HANDOFF_FAILED',
        message: 'Artifact Consumer rejected or failed the handoff',
      },
    ])
  }

  const resultValidation = validateArtifactHandoffResult(
    consumerResult,
    canonicalRequest.handoffId,
  )
  if (!resultValidation.valid) {
    return failure(resultValidation.issues)
  }

  if ((consumerResult as ArtifactHandoffResult).ok === true) {
    return Object.freeze({
      ok: true,
      handoffId: canonicalRequest.handoffId,
    })
  }

  return failure((consumerResult as Extract<
    ArtifactHandoffResult,
    { ok: false }
  >).issues)
}
