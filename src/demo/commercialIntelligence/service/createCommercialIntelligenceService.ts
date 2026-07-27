import {
  createProductionIntelligenceService,
  type ProductionIntelligenceService,
} from '../../productionIntelligence'
import type { DemoRequest } from '../../commercialDemo'
import {
  demoTemplateRegistry,
  productionWorkflowRegistry,
  type DemoTemplateRegistry,
  type ProductionWorkflowRegistry,
} from '../../productionRuntimeDemo'
import { createProductionEstimate } from '../estimate/createProductionEstimate'
import { createCommercialProposal } from '../proposal/createCommercialProposal'
import { createCommercialRecommendationService } from '../recommendation/createCommercialRecommendation'
import type {
  CommercialIntelligenceService,
  CreateCommercialProposalInput,
  CreateProductionEstimateInput,
} from '../types'

export function createCommercialIntelligenceService(
  intelligence: ProductionIntelligenceService =
    createProductionIntelligenceService(demoTemplateRegistry),
  templates: DemoTemplateRegistry = demoTemplateRegistry,
  workflows: ProductionWorkflowRegistry = productionWorkflowRegistry,
): CommercialIntelligenceService {
  const recommendationService = createCommercialRecommendationService()

  return Object.freeze({
    createProposal(input: CreateCommercialProposalInput) {
      return createCommercialProposal(input)
    },
    createEstimate(input: CreateProductionEstimateInput) {
      return createProductionEstimate(input)
    },
    createRecommendation(request: DemoRequest) {
      const generated = intelligence.generateScenario(
        request.prompt,
        request.requestedTemplate,
      )
      if (
        generated.intent.category !== request.category ||
        !templates
          .getTemplates()
          .some(
            (template) =>
              template.templateId === generated.recommendation.templateId &&
              template.category === generated.intent.category,
          )
      ) {
        throw new TypeError(
          'Commercial Recommendation is incompatible with the Demo Request or Template Registry',
        )
      }
      if (
        !workflows
          .getWorkflows()
          .some(
            (workflow) =>
              workflow.scenarioId === generated.scenario.scenarioId,
          )
      ) {
        throw new RangeError(
          `Workflow Contract is unavailable for Scenario: ${generated.scenario.scenarioId}`,
        )
      }

      return recommendationService.createRecommendation({
        requestId: request.requestId,
        intent: generated.intent,
        templateRecommendation: generated.recommendation,
        scenario: generated.scenario,
      })
    },
  })
}
