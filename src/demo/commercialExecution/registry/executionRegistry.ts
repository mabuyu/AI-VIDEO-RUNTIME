import { demoExecutionStages } from '../stages/demoExecutionStages'
import type { DemoExecutionRegistry } from '../types'

export const demoExecutionRegistry: DemoExecutionRegistry = Object.freeze({
  getSimulationStages() {
    return demoExecutionStages
  },
})
