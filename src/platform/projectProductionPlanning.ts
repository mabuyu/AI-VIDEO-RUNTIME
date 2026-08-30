import type {
  GenerationTask,
  ProductionOutputSpecification,
  ProductionPlan,
  ProductionRequest,
} from '../production/contracts'
import {
  validateProductionPlan,
  validateProductionRequest,
} from '../production/validation'
import type { ProductionPlanningBoundary } from './contracts'

const REFERENCE_PROVIDER_ID = 'provider:deterministic-reference'

function freezeOutputSpecification(
  outputSpecification: ProductionOutputSpecification,
): ProductionOutputSpecification {
  return Object.freeze({
    mediaType: outputSpecification.mediaType,
    format: outputSpecification.format,
  })
}

export function createDeterministicProductionPlanningBoundary(): ProductionPlanningBoundary {
  return Object.freeze({
    createPlan(request: ProductionRequest): ProductionPlan {
      const requestValidation = validateProductionRequest(request)
      if (!requestValidation.valid) {
        throw new TypeError('Production planning requires a valid ProductionRequest')
      }

      const outputSpecification = freezeOutputSpecification(
        request.outputSpecification,
      )
      const task: GenerationTask = Object.freeze({
        taskId: `generation-task:${request.requestId}`,
        requestId: request.requestId,
        providerId: REFERENCE_PROVIDER_ID,
        generationIntent: request.generationIntent,
        outputSpecification,
      })
      const plan: ProductionPlan = Object.freeze({
        planId: `production-plan:${request.requestId}`,
        requestId: request.requestId,
        tasks: Object.freeze([task]),
      })

      const planValidation = validateProductionPlan(plan)
      if (!planValidation.valid) {
        throw new TypeError('Deterministic production planning created an invalid plan')
      }

      return plan
    },
  })
}
