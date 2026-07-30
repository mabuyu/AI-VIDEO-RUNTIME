import type { ProductionPlan } from '../../production/contracts'
import type { ExecutionResult } from './executionResult'

export interface GenerationPipeline {
  execute(
    executionId: string,
    plan: ProductionPlan,
  ): Promise<ExecutionResult>
}
