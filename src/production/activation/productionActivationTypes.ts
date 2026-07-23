import type { ProductionAttempt } from '../types/productionAttempt'
import type { VideoReference } from '../provider'
import type { ArtifactRuntimeReference } from '../../artifacts/runtime'

export interface ProductionActivationRequest {
  readonly activationId: string
  readonly productionJobId: string
  readonly productionAttemptId: string
  readonly videoReference: VideoReference
}

export interface ProductionActivationRequestInput {
  readonly activationId: string
  readonly attempt: ProductionAttempt
  readonly videoReference: VideoReference
}

export interface ProductionActivationIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
}

export type ProductionActivationRequestCreationResult =
  | {
      readonly ok: true
      readonly request: ProductionActivationRequest
    }
  | {
      readonly ok: false
      readonly issues: readonly ProductionActivationIssue[]
    }

export type ProductionActivationResult =
  | {
      readonly ok: true
      readonly artifactRuntimeReference: ArtifactRuntimeReference
    }
  | {
      readonly ok: false
      readonly issues: readonly ProductionActivationIssue[]
    }

export interface ArtifactActivationPort {
  activate(
    request: ProductionActivationRequest,
  ): Promise<ProductionActivationResult>
}
