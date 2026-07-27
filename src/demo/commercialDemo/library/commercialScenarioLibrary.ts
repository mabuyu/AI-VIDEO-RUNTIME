import {
  demoScenarioRegistry,
  type DemoScenario,
} from '../../productionRuntimeDemo'

const commercialScenarioIds = Object.freeze([
  'product-launch-showcase-001',
  'brand-story-showcase-001',
  'tutorial-showcase-001',
  'social-campaign-showcase-001',
])

function selectCommercialScenarios(): readonly DemoScenario[] {
  const scenarios = commercialScenarioIds.map((scenarioId) => {
    const scenario = demoScenarioRegistry
      .getScenarios()
      .find((candidate) => candidate.scenarioId === scenarioId)
    if (scenario === undefined) {
      throw new RangeError(
        `Commercial Scenario is unavailable in DemoScenarioRegistry: ${scenarioId}`,
      )
    }
    return scenario
  })

  return Object.freeze(scenarios)
}

export const commercialScenarioLibrary: readonly DemoScenario[] =
  selectCommercialScenarios()
