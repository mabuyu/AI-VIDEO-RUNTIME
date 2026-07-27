import type {
  DemoScenario,
  DemoScenarioCategory,
} from '../productionRuntimeDemo'

export interface PromptExtractedRequirements {
  readonly subject: string
  readonly audience: string
  readonly style: string
  readonly duration: string
  readonly platform?: string
}

export interface PromptIntent {
  readonly intentId: string
  readonly rawPrompt: string
  readonly category: DemoScenarioCategory
  readonly objective: string
  readonly extractedRequirements: PromptExtractedRequirements
}

export interface TemplateRecommendation {
  readonly recommendationId: string
  readonly templateId: string
  readonly confidence: number
  readonly reason: string
}

export interface ScenarioGenerationService {
  createScenario(
    intent: PromptIntent,
    recommendation: TemplateRecommendation,
  ): DemoScenario
}

export interface GeneratedScenarioResult {
  readonly intent: PromptIntent
  readonly recommendation: TemplateRecommendation
  readonly scenario: DemoScenario
}

export interface ProductionIntelligenceService {
  generateScenario(
    rawPrompt: string,
    requestedTemplateId?: string,
  ): GeneratedScenarioResult
}
