import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const intelligenceSourceFiles = Object.freeze([
  '../src/demo/commercialIntelligence/types.ts',
  '../src/demo/commercialIntelligence/proposal/createCommercialProposal.ts',
  '../src/demo/commercialIntelligence/estimate/createProductionEstimate.ts',
  '../src/demo/commercialIntelligence/recommendation/createCommercialRecommendation.ts',
  '../src/demo/commercialIntelligence/service/createCommercialIntelligenceService.ts',
  '../src/demo/commercialIntelligence/index.ts',
])

function assertDeepFrozen(value, label) {
  if (typeof value !== 'object' || value === null) {
    return
  }
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`)
  }
}

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

function assertForbiddenImportsAbsent(sourceText) {
  const importSpecifiers = [
    ...sourceText.matchAll(/from\s+['"]([^'"]+)['"]/g),
  ].map((match) => match[1])

  for (const specifier of importSpecifiers) {
    assert.equal(
      /\/(?:runtime|runtimeData|artifacts|production|providers)(?:\/|$)/.test(
        specifier,
      ),
      false,
      `Forbidden Commercial Intelligence import: ${specifier}`,
    )
  }
}

try {
  const demo = await server.ssrLoadModule('/src/demo/index.ts')
  const {
    createCommercialDemoExecutionSimulator,
    createCommercialDemoReport,
    createCommercialDemoService,
    createCommercialIntelligenceService,
    createDemoRequest,
    createDemoShowcasePipeline,
    createProductionIntelligenceService,
    demoScenarioRegistry,
    demoTemplateRegistry,
    productionWorkflowRegistry,
    validateDemoScenarioPack,
  } = demo

  const request = createDemoRequest({
    requestId: 'product-launch-001',
    prompt:
      'Create a 30 second technology product launch video for young users.',
    category: 'marketing',
    requestedTemplate: 'product-launch-template-001',
    metadata: { commercialIntelligence: true },
  })

  const productionIntelligence = createProductionIntelligenceService()
  let intelligenceCalls = 0
  const intelligenceProbe = Object.freeze({
    generateScenario(prompt, requestedTemplateId) {
      intelligenceCalls += 1
      return productionIntelligence.generateScenario(
        prompt,
        requestedTemplateId,
      )
    },
  })
  let templateReads = 0
  const templateProbe = Object.freeze({
    getTemplates() {
      templateReads += 1
      return demoTemplateRegistry.getTemplates()
    },
  })
  let workflowReads = 0
  const workflowProbe = Object.freeze({
    getWorkflows() {
      workflowReads += 1
      return productionWorkflowRegistry.getWorkflows()
    },
  })

  const service = createCommercialIntelligenceService(
    intelligenceProbe,
    templateProbe,
    workflowProbe,
  )
  assert.deepEqual(Object.keys(service), [
    'createProposal',
    'createEstimate',
    'createRecommendation',
  ])
  assert.equal(Object.isFrozen(service), true)

  const result = service.createRecommendation(request)
  assert.deepEqual(Object.keys(result), [
    'intelligenceId',
    'intent',
    'templateRecommendation',
    'scenario',
    'proposal',
    'estimate',
  ])

  const proposal = result.proposal
  assert.deepEqual(Object.keys(proposal), [
    'proposalId',
    'requestId',
    'category',
    'objective',
    'targetAudience',
    'recommendedTemplateId',
    'recommendedScenarioId',
    'creativeDirection',
    'durationEstimate',
    'productionTier',
  ])
  assert.equal(proposal.proposalId, 'proposal-product-launch-001')
  assert.equal(proposal.requestId, request.requestId)
  assert.equal(proposal.category, 'marketing')
  assert.equal(proposal.recommendedTemplateId, request.requestedTemplate)
  assert.equal(proposal.recommendedScenarioId, result.scenario.scenarioId)
  assert.equal(proposal.durationEstimate, '30s')
  assert.equal(proposal.productionTier, 'standard')
  assertDeepFrozen(proposal, 'proposal')

  const proposalInput = {
    requestId: request.requestId,
    intent: result.intent,
    templateRecommendation: result.templateRecommendation,
    scenario: result.scenario,
  }
  const proposalInputSnapshot = JSON.stringify(proposalInput)
  const standaloneProposal = service.createProposal(proposalInput)
  assert.equal(JSON.stringify(proposalInput), proposalInputSnapshot)
  assert.deepEqual(standaloneProposal, proposal)
  assertDeepFrozen(standaloneProposal, 'standaloneProposal')

  const estimate = result.estimate
  assert.deepEqual(Object.keys(estimate), [
    'estimateId',
    'scenarioId',
    'sceneCount',
    'estimatedDuration',
    'complexityLevel',
    'productionTier',
  ])
  assert.equal(estimate.estimateId, `estimate-${result.scenario.scenarioId}`)
  assert.equal(estimate.scenarioId, result.scenario.scenarioId)
  assert.equal(estimate.sceneCount, 5)
  assert.equal(estimate.estimatedDuration, '30s')
  assert.equal(estimate.complexityLevel, 'medium')
  assert.equal(estimate.productionTier, 'standard')
  assertDeepFrozen(estimate, 'estimate')

  assert.equal(intelligenceCalls, 1)
  assert.equal(templateReads, 1)
  assert.equal(workflowReads, 1)
  assert.equal(
    demoTemplateRegistry
      .getTemplates()
      .some(
        (template) =>
          template.templateId === result.templateRecommendation.templateId,
      ),
    true,
  )

  const registeredScenario = demoScenarioRegistry
    .getScenarios()
    .find((scenario) => scenario.scenarioId === result.scenario.scenarioId)
  assert.notEqual(registeredScenario, undefined)
  assert.equal(registeredScenario.category, result.scenario.category)
  assert.equal(
    validateDemoScenarioPack(demoScenarioRegistry.getScenarios()).ok,
    true,
  )
  assert.equal(
    productionWorkflowRegistry
      .getWorkflows()
      .some(
        (workflow) =>
          workflow.scenarioId === result.scenario.scenarioId,
      ),
    true,
  )

  const planningService = createCommercialDemoService()
  const plan = planningService.createPlan(request)
  const pipeline = createDemoShowcasePipeline()
  const simulation =
    createCommercialDemoExecutionSimulator().simulate(plan)

  const legacyReport = createCommercialDemoReport(plan, pipeline)
  assert.equal(legacyReport.scenarioId, plan.scenario.scenarioId)
  const executionReport = createCommercialDemoReport(
    plan,
    pipeline,
    simulation,
  )
  assert.equal(executionReport.simulation, simulation)

  const intelligenceReport = createCommercialDemoReport({
    proposal,
    estimate,
    simulation,
  })
  assert.deepEqual(Object.keys(intelligenceReport), [
    'reportId',
    'proposal',
    'estimate',
    'recommendation',
    'simulation',
  ])
  assert.equal(intelligenceReport.proposal, proposal)
  assert.equal(intelligenceReport.estimate, estimate)
  assert.deepEqual(intelligenceReport.recommendation, {
    recommendedTemplateId: proposal.recommendedTemplateId,
    recommendedScenarioId: proposal.recommendedScenarioId,
  })
  assert.equal(intelligenceReport.simulation, simulation)
  assertDeepFrozen(intelligenceReport, 'intelligenceReport')

  const intelligenceSources = await Promise.all(
    intelligenceSourceFiles.map(readSource),
  )
  const sourceText = intelligenceSources.join('\n')
  assertForbiddenImportsAbsent(sourceText)
  for (const forbiddenSymbol of [
    'ProductionJob',
    'ProductionAttempt',
    'ArtifactEnvelope',
    'RuntimeDataV2',
    'RuntimeContext',
    'VideoProvider',
    'createProductionJob',
    'createProductionAttempt',
    '.activate(',
    '.consume(',
    '.render(',
  ]) {
    assert.equal(
      sourceText.includes(forbiddenSymbol),
      false,
      `Forbidden Commercial Intelligence symbol: ${forbiddenSymbol}`,
    )
  }
  for (const requiredReuse of [
    'createProductionIntelligenceService',
    'demoTemplateRegistry',
    'productionWorkflowRegistry',
  ]) {
    assert.equal(
      sourceText.includes(requiredReuse),
      true,
      `Existing intelligence dependency must be reused: ${requiredReuse}`,
    )
  }

  assert.equal(
    planningService.createPlan(request).scenario.scenarioId,
    result.scenario.scenarioId,
  )
  assert.equal(
    createCommercialDemoExecutionSimulator()
      .simulate(plan)
      .status,
    'COMPLETED',
  )

  console.log('Commercial Intelligence Validation')
  console.log('1. Proposal Contract: PASS')
  console.log('2. Proposal Immutable: PASS')
  console.log('3. Estimate Contract: PASS')
  console.log('4. Recommendation Flow: PASS')
  console.log('5. Existing Intelligence Reuse: PASS')
  console.log('6. Scenario Compatibility: PASS')
  console.log('7. Commercial Report Compatibility: PASS')
  console.log('8. Forbidden Coupling: PASS')
  console.log('9. Runtime Isolation: PASS')
  console.log('10. Existing Demo Regression: PASS')
} finally {
  await server.close()
}
