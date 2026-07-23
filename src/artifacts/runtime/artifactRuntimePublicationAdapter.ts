import type { ArtifactEnvelope } from '../contracts'
import type { ArtifactRuntimeReference } from './artifactRuntimeReference'
import { createArtifactRuntimeReference } from './createArtifactRuntimeReference'

export interface ArtifactRuntimePublicationIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
}

export type ArtifactRuntimePublicationResult =
  | {
      readonly ok: true
      readonly artifactRuntimeReference: ArtifactRuntimeReference
    }
  | {
      readonly ok: false
      readonly issues: readonly ArtifactRuntimePublicationIssue[]
    }

export interface ArtifactRuntimePublicationPort {
  publish(artifact: ArtifactEnvelope): ArtifactRuntimePublicationResult
}

function failure(
  issue: ArtifactRuntimePublicationIssue,
): ArtifactRuntimePublicationResult {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ ...issue })]),
  })
}

export function createArtifactRuntimePublicationAdapter():
  ArtifactRuntimePublicationPort {
  return Object.freeze({
    publish(artifact: ArtifactEnvelope): ArtifactRuntimePublicationResult {
      try {
        const artifactRuntimeReference =
          createArtifactRuntimeReference(artifact)
        return Object.freeze({
          ok: true,
          artifactRuntimeReference,
        })
      } catch {
        return failure({
          code: 'RUNTIME_REFERENCE_PUBLICATION_FAILED',
          message:
            'Verified READY Artifact could not be published as a Runtime Reference',
        })
      }
    },
  })
}
