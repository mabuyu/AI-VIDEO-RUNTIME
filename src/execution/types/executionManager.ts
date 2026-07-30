import type { ProductionPlan } from '../../production/contracts'
import type { ExecutionResult } from './executionResult'

export interface ExecutionManager {
  execute(plan: ProductionPlan): Promise<ExecutionResult>
}
