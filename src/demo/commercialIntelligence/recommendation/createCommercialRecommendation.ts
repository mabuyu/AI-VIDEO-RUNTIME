import { createProductionEstimate } from '../estimate/createProductionEstimate'
import { createCommercialProposal } from '../proposal/createCommercialProposal'
import type {
  CommercialIntelligenceResult,
  CommercialRecommendationInput,
  CommercialRecommendationService,
} from '../types'

export function createCommercialRecommendation(
  input: CommercialRecommendationInput,
): CommercialIntelligenceResult {
  const proposal = createCommercialProposal({
    requestId: input.requestId,
    intent: input.intent,
    templateRecommendation: input.templateRecommendation,
    scenario: input.scenario,
  })
  const estimate = createProductionEstimate({
    scenario: input.scenario,
    proposal,
  })

  return Object.freeze({
    intelligenceId: `commercial-intelligence-${input.requestId}`,
    intent: input.intent,
    templateRecommendation: input.templateRecommendation,
    scenario: input.scenario,
    proposal,
    estimate,
  })
}

export function createCommercialRecommendationService(): CommercialRecommendationService {
  return Object.freeze({
    createRecommendation(input: CommercialRecommendationInput) {
      return createCommercialRecommendation(input)
    },
  })
}
