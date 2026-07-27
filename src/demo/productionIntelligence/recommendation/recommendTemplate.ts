import {
  demoTemplateRegistry,
  type DemoTemplateRegistry,
} from '../../productionRuntimeDemo'
import type {
  PromptIntent,
  TemplateRecommendation,
} from '../types'

const confidenceByCategory = Object.freeze({
  marketing: 0.92,
  education: 0.9,
  social: 0.88,
})

export function recommendTemplate(
  intent: PromptIntent,
  registry: DemoTemplateRegistry = demoTemplateRegistry,
  requestedTemplateId?: string,
): TemplateRecommendation {
  const template = registry.getTemplates().find((candidate) =>
    requestedTemplateId === undefined
      ? candidate.category === intent.category
      : candidate.templateId === requestedTemplateId &&
        candidate.category === intent.category,
  )

  if (template === undefined) {
    throw new RangeError(
      requestedTemplateId === undefined
        ? `No Demo Scenario Template supports category: ${intent.category}`
        : `Requested Demo Scenario Template is unavailable for category ${intent.category}: ${requestedTemplateId}`,
    )
  }

  return Object.freeze({
    recommendationId: `template-recommendation-${intent.intentId}`,
    templateId: template.templateId,
    confidence: confidenceByCategory[intent.category],
    reason:
      requestedTemplateId === undefined
        ? `${intent.category} ${intent.objective}`
        : `requested ${template.name} for ${intent.category} ${intent.objective}`,
  })
}
