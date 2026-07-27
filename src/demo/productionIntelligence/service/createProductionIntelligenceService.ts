import {
  demoTemplateRegistry,
  type DemoTemplateRegistry,
} from '../../productionRuntimeDemo'
import { createScenarioGenerationService } from '../generation/createScenarioFromIntent'
import { createPromptIntent } from '../intent/createPromptIntent'
import { recommendTemplate } from '../recommendation/recommendTemplate'
import type {
  GeneratedScenarioResult,
  ProductionIntelligenceService,
} from '../types'

export function createProductionIntelligenceService(
  registry: DemoTemplateRegistry = demoTemplateRegistry,
): ProductionIntelligenceService {
  const generationService = createScenarioGenerationService(registry)

  return Object.freeze({
    generateScenario(
      rawPrompt: string,
      requestedTemplateId?: string,
    ): GeneratedScenarioResult {
      const intent = createPromptIntent(rawPrompt)
      const recommendation = recommendTemplate(
        intent,
        registry,
        requestedTemplateId,
      )
      const scenario = generationService.createScenario(
        intent,
        recommendation,
      )

      return Object.freeze({
        intent,
        recommendation,
        scenario,
      })
    },
  })
}
