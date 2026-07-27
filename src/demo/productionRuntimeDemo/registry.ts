import { productionRuntimeDemoScenarios } from './scenarios'
import type { DemoScenarioRegistry } from './types'

export const demoScenarioRegistry: DemoScenarioRegistry = Object.freeze({
  getScenarios() {
    return productionRuntimeDemoScenarios
  },
})
