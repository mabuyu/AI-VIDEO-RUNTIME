import {
  createScenarioFromTemplate,
  demoTemplateRegistry,
  type DemoScenario,
  type DemoTemplateInput,
  type DemoTemplateInputValue,
  type DemoTemplateRegistry,
} from '../../productionRuntimeDemo'
import type {
  PromptIntent,
  ScenarioGenerationService,
  TemplateRecommendation,
} from '../types'

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/)
  const seconds = match === null ? Number.NaN : Number(match[1])
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new TypeError(`Unsupported intent duration: ${duration}`)
  }
  return seconds
}

function createTemplateInput(
  intent: PromptIntent,
  inputKeys: readonly string[],
): DemoTemplateInput {
  const requirements = intent.extractedRequirements
  const values: Readonly<Record<string, DemoTemplateInputValue | undefined>> =
    Object.freeze({
      productName: requirements.subject,
      targetAudience: requirements.audience,
      topic: requirements.subject,
      audience: requirements.audience,
      style: requirements.style,
      duration: parseDuration(requirements.duration),
      platform: requirements.platform ?? 'social',
    })

  return Object.freeze(
    Object.fromEntries(
      inputKeys.map((key) => {
        const value = values[key]
        if (value === undefined) {
          throw new TypeError(
            `No Prompt Intent mapping exists for Template input: ${key}`,
          )
        }
        return [key, value]
      }),
    ),
  )
}

export function createScenarioFromIntent(
  intent: PromptIntent,
  recommendation: TemplateRecommendation,
  registry: DemoTemplateRegistry = demoTemplateRegistry,
): DemoScenario {
  const template = registry
    .getTemplates()
    .find((candidate) => candidate.templateId === recommendation.templateId)

  if (template === undefined) {
    throw new RangeError(
      `Recommended Demo Scenario Template is unavailable: ${recommendation.templateId}`,
    )
  }
  if (template.category !== intent.category) {
    throw new TypeError(
      'Template Recommendation category does not match Prompt Intent',
    )
  }

  return createScenarioFromTemplate(
    template,
    createTemplateInput(intent, Object.keys(template.inputSchema)),
  )
}

export function createScenarioGenerationService(
  registry: DemoTemplateRegistry = demoTemplateRegistry,
): ScenarioGenerationService {
  return Object.freeze({
    createScenario(
      intent: PromptIntent,
      recommendation: TemplateRecommendation,
    ) {
      return createScenarioFromIntent(intent, recommendation, registry)
    },
  })
}
