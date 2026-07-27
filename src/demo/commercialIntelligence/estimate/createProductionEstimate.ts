import type {
  CommercialProductionTier,
  CreateProductionEstimateInput,
  ProductionComplexityLevel,
  ProductionEstimate,
} from '../types'

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

function selectComplexity(
  sceneCount: number,
): ProductionComplexityLevel {
  if (sceneCount <= 3) {
    return 'low'
  }
  if (sceneCount <= 8) {
    return 'medium'
  }
  return 'high'
}

export function createProductionEstimate(
  input: CreateProductionEstimateInput,
): ProductionEstimate {
  const durationSeconds = input.scenario.productionInput.targetDurationSeconds
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new TypeError(
      'Scenario target duration must be a positive finite number',
    )
  }

  const estimatedDuration = `${durationSeconds}s`
  const productionTier = selectProductionTier(durationSeconds)
  if (
    input.proposal !== undefined &&
    (input.proposal.recommendedScenarioId !== input.scenario.scenarioId ||
      input.proposal.durationEstimate !== estimatedDuration ||
      input.proposal.productionTier !== productionTier)
  ) {
    throw new TypeError(
      'Commercial Proposal does not match the Production Estimate Scenario',
    )
  }

  const sceneCount = Math.max(3, Math.ceil(durationSeconds / 6))

  return Object.freeze({
    estimateId: `estimate-${input.scenario.scenarioId}`,
    scenarioId: input.scenario.scenarioId,
    sceneCount,
    estimatedDuration,
    complexityLevel: selectComplexity(sceneCount),
    productionTier,
  })
}
