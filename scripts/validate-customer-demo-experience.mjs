import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const customerExperienceSourceFiles = Object.freeze([
  '../src/demo/customerExperience/types.ts',
  '../src/demo/customerExperience/session/createCustomerDemoSession.ts',
  '../src/demo/customerExperience/presentation/createDemoPresentation.ts',
  '../src/demo/customerExperience/service/createCustomerDemoExperienceService.ts',
  '../src/demo/customerExperience/index.ts',
])

const sessionStatuses = Object.freeze([
  'CREATED',
  'REQUEST_RECEIVED',
  'PROPOSAL_READY',
  'SIMULATION_READY',
  'PRESENTATION_READY',
  'COMPLETED',
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

function assertForbiddenPresentationContent(value, label) {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      assertForbiddenPresentationContent(child, `${label}[${index}]`),
    )
    return
  }
  if (typeof value === 'string') {
    assert.notEqual(value, 'READY', `${label} contains forbidden READY state`)
    return
  }
  if (typeof value !== 'object' || value === null) {
    return
  }
  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      /artifactId|runtimeReference|providerState/i.test(key),
      false,
      `${label} contains forbidden field ${key}`,
    )
    assertForbiddenPresentationContent(child, `${label}.${key}`)
  }
}

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

try {
  const demo = await server.ssrLoadModule('/src/demo/index.ts')
  const {
    createCommercialDemoExecutionSimulator,
    createCommercialPackageService,
    createCommercialDemoService,
    createCommercialIntelligenceService,
    createCustomerDemoExperienceService,
    createCustomerDemoSession,
    createDemoPresentation,
    createDemoRequest,
  } = demo

  const requestInput = {
    requestId: 'customer-experience-product-launch',
    prompt:
      'Create a 30 second technology product launch video for young users.',
    category: 'marketing',
    requestedTemplate: 'product-launch-template-001',
    metadata: {
      customer: { name: 'Nova Studio' },
      channels: ['sales', 'web'],
    },
  }
  const requestInputSnapshot = JSON.stringify(requestInput)
  const request = createDemoRequest(requestInput)

  const commercialDemo = createCommercialDemoService()
  const commercialIntelligence = createCommercialIntelligenceService()
  const executionSimulator = createCommercialDemoExecutionSimulator()
  const commercialPackages = createCommercialPackageService()
  let planningCalls = 0
  let proposalCalls = 0
  let simulationCalls = 0
  const service = createCustomerDemoExperienceService({
    commercialDemo: Object.freeze({
      createPlan(customerRequest) {
        planningCalls += 1
        return commercialDemo.createPlan(customerRequest)
      },
    }),
    commercialIntelligence: Object.freeze({
      ...commercialIntelligence,
      createProposal(input) {
        proposalCalls += 1
        return commercialIntelligence.createProposal(input)
      },
    }),
    executionSimulator: Object.freeze({
      simulate(plan) {
        simulationCalls += 1
        return executionSimulator.simulate(plan)
      },
    }),
    createSessionId: () => 'customer-demo-session-validation-001',
  })

  assert.equal(Object.isFrozen(service), true)
  assert.deepEqual(Object.keys(service), ['createDemoExperience'])

  const result = service.createDemoExperience({ request })
  assert.equal(JSON.stringify(requestInput), requestInputSnapshot)
  assert.deepEqual(Object.keys(result), ['session', 'presentation'])
  assertDeepFrozen(result, 'experienceResult')

  const { session, presentation } = result
  assert.deepEqual(Object.keys(session), [
    'sessionId',
    'customerRequest',
    'proposal',
    'simulation',
    'status',
  ])
  assert.equal(session.sessionId, 'customer-demo-session-validation-001')
  assert.equal(session.status, 'COMPLETED')
  assert.equal(session.customerRequest.requestId, request.requestId)
  assert.deepEqual(Object.keys(session.customerRequest), [
    'requestId',
    'prompt',
    'category',
  ])
  assert.notEqual(session.customerRequest, request)
  assert.notEqual(session.proposal, presentation.recommendedSolution)
  assert.notEqual(session.simulation, presentation.simulationSummary)
  assertDeepFrozen(session, 'session')

  assert.deepEqual(Object.keys(presentation), [
    'presentationId',
    'title',
    'customerGoal',
    'recommendedSolution',
    'packageRecommendationSummary',
    'workflowOverview',
    'simulationSummary',
    'valueSummary',
  ])
  assert.deepEqual(presentation.workflowOverview, [
    'Prompt',
    'Scenario',
    'Workflow',
    'Simulation',
  ])
  assert.deepEqual(presentation.recommendedSolution, {
    template: session.proposal.recommendedTemplateId,
    scenario: session.proposal.recommendedScenarioId,
  })
  assert.deepEqual(presentation.packageRecommendationSummary, {
    packageId: 'business-ai-video-package',
    name: 'Business AI Video Package',
    planId: 'business',
    planName: 'Business',
    tierId: 'professional',
    tierName: 'Professional',
    capabilities: [
      'Marketing Templates',
      'Education Templates',
      'Social Templates',
      'Premium Simulation',
    ],
  })
  assert.deepEqual(presentation.simulationSummary, {
    simulationId: session.simulation.simulationId,
    scenarioId: session.simulation.scenarioId,
    workflowId: session.simulation.workflowId,
    stageCount: session.simulation.stages.length,
    status: session.simulation.status,
  })
  assert.deepEqual(presentation.valueSummary, {
    productionReadiness: 'SIMULATED',
    workflowCompleteness: 'COMPLETE',
    demoStatus: 'COMPLETED',
  })
  assertDeepFrozen(presentation, 'presentation')
  assertForbiddenPresentationContent(presentation, 'presentation')

  assert.equal(planningCalls, 1)
  assert.equal(proposalCalls, 1)
  assert.equal(simulationCalls, 1)

  const standalonePresentation = createDemoPresentation({
    proposal: session.proposal,
    recommendedPackage: commercialPackages.recommendPackage({
      category: request.category,
      estimatedDurationSeconds: 30,
      estimatedSceneCount: 5,
      complexityLevel: 'medium',
      requiresPremiumSimulation: true,
    }),
    simulation: session.simulation,
  })
  assertDeepFrozen(standalonePresentation, 'standalonePresentation')
  const standaloneSession = createCustomerDemoSession({
    sessionId: 'standalone-session',
    customerRequest: request,
    proposal: session.proposal,
    simulation: session.simulation,
    status: sessionStatuses[0],
  })
  assert.equal(standaloneSession.status, 'CREATED')
  assertDeepFrozen(standaloneSession, 'standaloneSession')
  assert.throws(
    () =>
      createCustomerDemoSession({
        sessionId: 'invalid-status-session',
        customerRequest: request,
        proposal: session.proposal,
        simulation: session.simulation,
        status: 'READY',
      }),
    TypeError,
  )

  const sourceText = (
    await Promise.all(customerExperienceSourceFiles.map(readSource))
  ).join('\n')
  const importSpecifiers = [
    ...sourceText.matchAll(/from\s+['"]([^'"]+)['"]/g),
  ].map((match) => match[1])
  for (const specifier of importSpecifiers) {
    assert.equal(
      /\/(?:artifacts|runtime|renderer|providers|production)(?:\/|$)/.test(
        specifier,
      ),
      false,
      `Forbidden Customer Experience import: ${specifier}`,
    )
  }
  for (const forbiddenSymbol of [
    'ArtifactEnvelope',
    'ArtifactRuntimeReference',
    'RuntimeDataV2',
    'RuntimeContext',
    'Renderer',
    'VideoProvider',
    'ProviderState',
    'createProductionJob',
    'createArtifact',
    '.activate(',
    '.consume(',
    '.render(',
  ]) {
    assert.equal(
      sourceText.includes(forbiddenSymbol),
      false,
      `Forbidden Customer Experience symbol: ${forbiddenSymbol}`,
    )
  }
  assert.equal(
    /(?:class|const|function|interface|type)\s+\w*Registry/.test(sourceText),
    false,
    'Customer Experience must not duplicate a Registry',
  )
  for (const requiredReuse of [
    'createCommercialDemoService',
    'createCommercialIntelligenceService',
    'createCommercialDemoExecutionSimulator',
    'createCommercialPackageService',
  ]) {
    assert.equal(
      sourceText.includes(requiredReuse),
      true,
      `Existing capability must be reused: ${requiredReuse}`,
    )
  }

  console.log('Customer Demo Experience Validation')
  console.log('1. CustomerDemoSession Contract: PASS')
  console.log('2. Session immutable: PASS')
  console.log('3. Presentation Contract: PASS')
  console.log('4. Experience Service: PASS')
  console.log('5. Existing Intelligence reuse: PASS')
  console.log('6. Existing Simulation reuse: PASS')
  console.log('7. No duplicated Registry: PASS')
  console.log('8. Forbidden Coupling: PASS')
} finally {
  await server.close()
}
