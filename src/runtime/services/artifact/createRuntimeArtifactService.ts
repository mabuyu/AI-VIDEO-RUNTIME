import type { ArtifactRuntimeReference } from '../../../artifacts/runtime'
import { createRuntimeArtifactConsumptionAdapter } from './createRuntimeArtifactConsumptionAdapter'
import {
  createRuntimeArtifactConsumptionFailure,
  createRuntimeArtifactIssue,
} from './runtimeArtifactResult'
import type {
  RuntimeArtifactConsumptionAdapter,
  RuntimeArtifactConsumptionResult,
  RuntimeArtifactService,
} from './types'

export function createRuntimeArtifactService():
  RuntimeArtifactService
export function createRuntimeArtifactService(
  adapter: RuntimeArtifactConsumptionAdapter,
): RuntimeArtifactService
export function createRuntimeArtifactService(
  adapter: RuntimeArtifactConsumptionAdapter =
    createRuntimeArtifactConsumptionAdapter(),
): RuntimeArtifactService {
  return Object.freeze({
    async consume(
      reference: ArtifactRuntimeReference,
    ): Promise<RuntimeArtifactConsumptionResult> {
      try {
        return await adapter.consume(reference)
      } catch {
        return createRuntimeArtifactConsumptionFailure([
          createRuntimeArtifactIssue(
            'CONSUMPTION_FAILED',
            'Runtime Artifact Service failed to consume the reference',
          ),
        ])
      }
    },
  })
}
