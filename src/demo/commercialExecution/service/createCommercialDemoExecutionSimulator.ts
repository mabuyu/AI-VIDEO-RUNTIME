import { demoExecutionRegistry } from '../registry/executionRegistry'
import { createDemoExecutionSimulation } from '../simulation/createDemoExecutionSimulation'
import type { CommercialDemoPlan } from '../../commercialDemo'
import type {
  CommercialDemoExecutionSimulator,
  DemoExecutionRegistry,
} from '../types'

export function createCommercialDemoExecutionSimulator(
  registry: DemoExecutionRegistry = demoExecutionRegistry,
): CommercialDemoExecutionSimulator {
  return Object.freeze({
    simulate(plan: CommercialDemoPlan) {
      return createDemoExecutionSimulation(
        plan,
        registry.getSimulationStages(),
      )
    },
  })
}
