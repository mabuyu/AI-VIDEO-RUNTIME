import type {
  DemoScenario,
  DemoScenarioCategory,
} from '../productionRuntimeDemo'
import type {
  PromptIntent,
  TemplateRecommendation,
} from '../productionIntelligence'
import type { DemoRequest } from '../commercialDemo'

export type CommercialProductionTier = 'basic' | 'standard' | 'premium'

export type ProductionComplexityLevel = 'low' | 'medium' | 'high'

export interface CommercialDemoProposal {
  readonly proposalId: string
  readonly requestId: string
  readonly category: DemoScenarioCategory
  readonly objective: string
  readonly targetAudience: string
  readonly recommendedTemplateId: string
  readonly recommendedScenarioId: string
  readonly creativeDirection: string
  readonly durationEstimate: string
  readonly productionTier: CommercialProductionTier
}

export interface CreateCommercialProposalInput {
  readonly requestId: string
  readonly intent: PromptIntent
  readonly templateRecommendation: TemplateRecommendation
  readonly scenario: DemoScenario
}

export interface ProductionEstimate {
  readonly estimateId: string
  readonly scenarioId: string
  readonly sceneCount: number
  readonly estimatedDuration: string
  readonly complexityLevel: ProductionComplexityLevel
  readonly productionTier: CommercialProductionTier
}

export interface CreateProductionEstimateInput {
  readonly scenario: DemoScenario
  readonly proposal?: CommercialDemoProposal
}

export interface CommercialRecommendationInput {
  readonly requestId: string
  readonly intent: PromptIntent
  readonly templateRecommendation: TemplateRecommendation
  readonly scenario: DemoScenario
}

export interface CommercialIntelligenceResult {
  readonly intelligenceId: string
  readonly intent: PromptIntent
  readonly templateRecommendation: TemplateRecommendation
  readonly scenario: DemoScenario
  readonly proposal: CommercialDemoProposal
  readonly estimate: ProductionEstimate
}

export interface CommercialRecommendationService {
  createRecommendation(
    input: CommercialRecommendationInput,
  ): CommercialIntelligenceResult
}

export interface CommercialIntelligenceService {
  createProposal(
    input: CreateCommercialProposalInput,
  ): CommercialDemoProposal
  createEstimate(input: CreateProductionEstimateInput): ProductionEstimate
  createRecommendation(request: DemoRequest): CommercialIntelligenceResult
}
