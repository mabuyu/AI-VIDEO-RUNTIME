import type {
  CommercialDemoProposal,
  CommercialProductionTier,
  CreateCommercialProposalInput,
} from '../types'

function requireNonEmptyString(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function readDurationSeconds(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/)
  const seconds = match === null ? Number.NaN : Number(match[1])
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new TypeError(`Unsupported Commercial duration: ${duration}`)
  }
  return seconds
}

function selectProductionTier(
  durationSeconds: number,
): CommercialProductionTier {
  if (durationSeconds <= 15) {
    return 'basic'
  }
  if (durationSeconds <= 60) {
    return 'standard'
  }
  return 'premium'
}

function createCreativeDirection(
  style: string,
  category: CreateCommercialProposalInput['intent']['category'],
): string {
  const qualifier =
    category === 'marketing'
      ? 'premium'
      : category === 'education'
        ? 'clear'
        : 'engaging'
  return `${style} ${qualifier}`
}

export function createCommercialProposal(
  input: CreateCommercialProposalInput,
): CommercialDemoProposal {
  const requestId = requireNonEmptyString(input.requestId, 'requestId')
  const { intent, templateRecommendation, scenario } = input

  if (intent.category !== scenario.category) {
    throw new TypeError(
      'Prompt Intent category does not match the recommended Scenario',
    )
  }

  const durationEstimate = intent.extractedRequirements.duration
  const durationSeconds = readDurationSeconds(durationEstimate)
  if (
    durationSeconds !== scenario.productionInput.targetDurationSeconds
  ) {
    throw new TypeError(
      'Prompt Intent duration does not match the recommended Scenario',
    )
  }

  return Object.freeze({
    proposalId: `proposal-${requestId}`,
    requestId,
    category: intent.category,
    objective: requireNonEmptyString(intent.objective, 'objective'),
    targetAudience: requireNonEmptyString(
      intent.extractedRequirements.audience,
      'targetAudience',
    ),
    recommendedTemplateId: requireNonEmptyString(
      templateRecommendation.templateId,
      'recommendedTemplateId',
    ),
    recommendedScenarioId: requireNonEmptyString(
      scenario.scenarioId,
      'recommendedScenarioId',
    ),
    creativeDirection: createCreativeDirection(
      requireNonEmptyString(
        intent.extractedRequirements.style,
        'creativeDirection',
      ),
      intent.category,
    ),
    durationEstimate,
    productionTier: selectProductionTier(durationSeconds),
  })
}
