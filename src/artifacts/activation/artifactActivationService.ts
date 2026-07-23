import {
  createVideoArtifactIngestionPort,
  validateArtifactIngestionRequest,
  type ArtifactIngestionIssue,
  type ArtifactIngestionRequest,
} from '../ingestion'
import type { ArtifactEnvelope } from '../contracts'
import { consumeVideoReferenceToArtifact } from '../consumers/videoReferenceConsumer'
import {
  createArtifactRuntimePublicationAdapter,
  type ArtifactRuntimePublicationResult,
} from '../runtime'
import type {
  ArtifactActivationPort,
  ProductionActivationIssue,
  ProductionActivationRequest,
  ProductionActivationResult,
} from '../../production/activation'
import type { ArtifactActivationDependencies } from './artifactActivationTypes'

function freezeIssues(
  issues: readonly ProductionActivationIssue[],
): readonly ProductionActivationIssue[] {
  return Object.freeze(
    issues.map((issue) =>
      Object.freeze({
        code: issue.code,
        message: issue.message,
        ...(issue.path === undefined ? {} : { path: issue.path }),
      }),
    ),
  )
}

function failure(
  issues: readonly ProductionActivationIssue[],
): ProductionActivationResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

function mapIngestionIssues(
  issues: readonly ArtifactIngestionIssue[],
): readonly ProductionActivationIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    ...(issue.path === undefined ? {} : { path: issue.path }),
  }))
}

export class ArtifactActivationService implements ArtifactActivationPort {
  readonly #dependencies: ArtifactActivationDependencies

  constructor(dependencies: ArtifactActivationDependencies = {}) {
    this.#dependencies = Object.freeze({ ...dependencies })
  }

  async activate(
    request: ProductionActivationRequest,
  ): Promise<ProductionActivationResult> {
    const ingestionRequest: ArtifactIngestionRequest = Object.freeze({
      ingestionId: request.activationId,
      sourceReference: request.videoReference,
      productionContext: Object.freeze({
        productionJobId: request.productionJobId,
        productionAttemptId: request.productionAttemptId,
      }),
    })

    const requestValidation =
      validateArtifactIngestionRequest(ingestionRequest)
    if (!requestValidation.valid) {
      return failure(mapIngestionIssues(requestValidation.issues))
    }

    const runtimePublicationPort =
      this.#dependencies.runtimePublicationPort ??
      createArtifactRuntimePublicationAdapter()
    let readyArtifact: ArtifactEnvelope | undefined
    const videoArtifactConsumer =
      this.#dependencies.videoArtifactConsumer ??
      consumeVideoReferenceToArtifact
    const ingestionPort = createVideoArtifactIngestionPort(
      async (videoReference, source) => {
        const consumerResult = await videoArtifactConsumer(
          videoReference,
          source,
        )
        if (consumerResult.success) {
          readyArtifact = consumerResult.artifact
        }
        return consumerResult
      },
    )

    const ingestionResult = await ingestionPort.ingest(ingestionRequest)
    if (!ingestionResult.ok) {
      return failure(mapIngestionIssues(ingestionResult.issues))
    }

    if (readyArtifact === undefined) {
      return failure([
        {
          code: 'RUNTIME_REFERENCE_PUBLICATION_MISSING',
          message:
            'Artifact ingestion completed without an internal READY Artifact',
        },
      ])
    }

    const publicationResult: ArtifactRuntimePublicationResult =
      runtimePublicationPort.publish(readyArtifact)
    if (!publicationResult.ok) {
      return failure(publicationResult.issues)
    }

    return Object.freeze({
      ok: true,
      artifactRuntimeReference:
        publicationResult.artifactRuntimeReference,
    })
  }
}

export function createArtifactActivationService(
  dependencies: ArtifactActivationDependencies = {},
): ArtifactActivationService {
  const service = new ArtifactActivationService(dependencies)
  Object.freeze(service)
  return service
}
