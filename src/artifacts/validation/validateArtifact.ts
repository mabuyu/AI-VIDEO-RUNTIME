import {
  type ArtifactEnvelope,
  validateArtifactEnvelope,
} from '../contracts'
import type { ArtifactValidationIssue } from '../validators/artifactValidator'
import { videoArtifactValidator } from '../validators/videoArtifactValidator'

export interface ArtifactValidationPipelineResult {
  readonly artifact: ArtifactEnvelope
  readonly issues: readonly ArtifactValidationIssue[]
}

function failedArtifact(
  artifact: ArtifactEnvelope,
  issues: readonly ArtifactValidationIssue[],
): ArtifactValidationPipelineResult {
  return {
    artifact: {
      ...artifact,
      status: 'FAILED',
      validation: {
        status: 'failed',
        checks: artifact.validation.checks,
      },
    },
    issues,
  }
}

export async function validateArtifact(
  artifact: ArtifactEnvelope,
): Promise<ArtifactValidationPipelineResult> {
  if (artifact.artifactType !== 'video') {
    return failedArtifact(artifact, [
      {
        code: 'UNSUPPORTED_ARTIFACT_TYPE',
        message: `No validator is available for artifact type ${String(artifact.artifactType)}`,
        path: 'artifact.artifactType',
      },
    ])
  }

  const result = await videoArtifactValidator.validate(artifact)
  const validatedArtifact: ArtifactEnvelope = {
    ...artifact,
    status: result.valid ? 'READY' : 'FAILED',
    validation: result.validation,
  }
  const envelopeResult = validateArtifactEnvelope(validatedArtifact)

  if (!envelopeResult.valid) {
    return failedArtifact(
      validatedArtifact,
      [
        ...result.issues,
        ...envelopeResult.issues.map((message) => ({
          code: 'INVALID_ARTIFACT_ENVELOPE',
          message,
        })),
      ],
    )
  }

  return { artifact: validatedArtifact, issues: result.issues }
}
