import {
  createProductionIntelligenceService,
  type ProductionIntelligenceService,
} from '../../productionIntelligence'
import {
  productionWorkflowRegistry,
  type ProductionWorkflowRegistry,
} from '../../productionRuntimeDemo'
import type {
  CommercialDemoPlan,
  CommercialDemoService,
  DemoRequest,
} from '../types'

export function createCommercialDemoService(
  intelligence: ProductionIntelligenceService =
    createProductionIntelligenceService(),
  workflows: ProductionWorkflowRegistry = productionWorkflowRegistry,
): CommercialDemoService {
  return Object.freeze({
    createPlan(request: DemoRequest): CommercialDemoPlan {
      const generated = intelligence.generateScenario(
        request.prompt,
        request.requestedTemplate,
      )
      if (generated.intent.category !== request.category) {
        throw new TypeError(
          'Demo Request category does not match Production Intelligence intent',
        )
      }

      const workflow = workflows
        .getWorkflows()
        .find(
          (candidate) =>
            candidate.scenarioId === generated.scenario.scenarioId,
        )
      if (workflow === undefined) {
        throw new RangeError(
          `Workflow Contract is unavailable for Scenario: ${generated.scenario.scenarioId}`,
        )
      }

      return Object.freeze({
        request,
        intent: generated.intent,
        recommendation: generated.recommendation,
        scenario: generated.scenario,
        workflow,
      })
    },
  })
}
