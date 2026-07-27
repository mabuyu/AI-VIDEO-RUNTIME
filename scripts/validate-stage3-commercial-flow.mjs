import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertDeepFrozen(value, label) {
  if (typeof value !== 'object' || value === null) {
    return
  }

  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`)
  }
}

try {
  const demo = await server.ssrLoadModule('/src/demo/index.ts')
  const {
    createCommercialDemoExecutionSimulator,
    createCommercialDemoService,
    createCommercialIntelligenceService,
    createCommercialPackageService,
    createDemoPresentation,
    createDemoRequest,
    createGenerationRequest,
  } = demo

  const customerRequest = createDemoRequest({
    requestId: 'stage3-commercial-closure-request',
    prompt:
      'Create a 30 second cinematic technology product launch video for young users.',
    category: 'marketing',
    requestedTemplate: 'product-launch-template-001',
    metadata: { workPackage: 'WP-I', validation: 'commercial-flow' },
  })

  const commercialIntelligence =
    createCommercialIntelligenceService().createRecommendation(
      customerRequest,
    )
  const promptIntent = commercialIntelligence.intent
  const templateRecommendation =
    commercialIntelligence.templateRecommendation
  const scenario = commercialIntelligence.scenario
  const commercialProposal = commercialIntelligence.proposal
  const estimate = commercialIntelligence.estimate

  const packageRecommendation =
    createCommercialPackageService().recommendPackage({
      category: customerRequest.category,
      estimatedDurationSeconds:
        scenario.productionInput.targetDurationSeconds,
      estimatedSceneCount: estimate.sceneCount,
      complexityLevel: estimate.complexityLevel,
      requiresPremiumSimulation: true,
    })

  const generationRequest = createGenerationRequest({
    requestId: `generation-${customerRequest.requestId}`,
    prompt: customerRequest.prompt,
    style: commercialProposal.creativeDirection,
    duration: scenario.productionInput.targetDurationSeconds,
    sceneCount: estimate.sceneCount,
    qualityTier: packageRecommendation.tier.capabilityLevel,
  })

  const productionIntelligenceResult = Object.freeze({
    intent: promptIntent,
    recommendation: templateRecommendation,
    scenario,
  })
  const commercialPlan = createCommercialDemoService(
    Object.freeze({
      generateScenario() {
        return productionIntelligenceResult
      },
    }),
  ).createPlan(customerRequest)
  assert.equal(commercialPlan.intent.intentId, promptIntent.intentId)
  assert.equal(
    commercialPlan.recommendation.recommendationId,
    templateRecommendation.recommendationId,
  )
  assert.equal(commercialPlan.scenario.scenarioId, scenario.scenarioId)

  const simulation =
    createCommercialDemoExecutionSimulator().simulate(commercialPlan)
  const presentation = createDemoPresentation({
    proposal: commercialProposal,
    recommendedPackage: packageRecommendation,
    simulation,
  })

  const flowOutputs = Object.freeze([
    ['Customer Request', customerRequest],
    ['Prompt Intent', promptIntent],
    ['Template Recommendation', templateRecommendation],
    ['Scenario', scenario],
    ['Commercial Proposal', commercialProposal],
    ['Package Recommendation', packageRecommendation],
    ['Generation Request', generationRequest],
    ['Simulation', simulation],
    ['Presentation', presentation],
  ])

  for (const [label, output] of flowOutputs) {
    assert.notEqual(output, undefined, `${label} output must exist`)
    assert.notEqual(output, null, `${label} output must exist`)
    assertDeepFrozen(output, label)
  }

  assert.equal(promptIntent.rawPrompt, customerRequest.prompt)
  assert.equal(
    templateRecommendation.templateId,
    commercialProposal.recommendedTemplateId,
  )
  assert.equal(
    scenario.scenarioId,
    commercialProposal.recommendedScenarioId,
  )
  assert.equal(generationRequest.prompt, customerRequest.prompt)
  assert.equal(
    generationRequest.qualityTier,
    packageRecommendation.tier.capabilityLevel,
  )
  assert.equal(simulation.requestId, customerRequest.requestId)
  assert.equal(simulation.scenarioId, scenario.scenarioId)
  assert.equal(
    presentation.recommendedSolution.template,
    templateRecommendation.templateId,
  )
  assert.equal(
    presentation.packageRecommendationSummary.packageId,
    packageRecommendation.packageId,
  )
  assert.equal(presentation.valueSummary.productionReadiness, 'SIMULATED')

  await access(new URL('../dist/index.html', import.meta.url))

  console.log('Stage3 End-to-End Commercial Flow Validation')
  console.log('1. Customer Request: PASS')
  console.log('2. Prompt Intent: PASS')
  console.log('3. Template Recommendation: PASS')
  console.log('4. Scenario: PASS')
  console.log('5. Commercial Proposal: PASS')
  console.log('6. Package Recommendation: PASS')
  console.log('7. Generation Request: PASS')
  console.log('8. Simulation: PASS')
  console.log('9. Presentation: PASS')
  console.log('10. Every Step Output Exists: PASS')
  console.log('11. All Objects Immutable: PASS')
} finally {
  await server.close()
}
