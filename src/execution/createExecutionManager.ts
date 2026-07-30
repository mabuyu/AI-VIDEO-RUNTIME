import type { ProviderRegistry } from '../providers/registry'
import type { ProductionPlan } from '../production/contracts'
import { createGenerationPipeline } from './pipeline'
import type { ExecutionManager, ExecutionResult } from './types'

export function createExecutionManager(
  providerRegistry: ProviderRegistry,
): ExecutionManager {
  return Object.freeze({
    async execute(plan: ProductionPlan): Promise<ExecutionResult> {
      const pipeline = createGenerationPipeline(providerRegistry)
      return pipeline.execute(`execution:${plan.planId}`, plan)
    },
  })
}
