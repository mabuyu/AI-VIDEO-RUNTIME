import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const expectedStageNames = Object.freeze([
  'REQUEST_RECEIVED',
  'INTENT_ANALYZED',
  'TEMPLATE_SELECTED',
  'SCENARIO_GENERATED',
  'WORKFLOW_CREATED',
  'PRODUCTION_READY',
  'ARTIFACT_READY_SIMULATION',
  'RUNTIME_READY_SIMULATION',
  'DEMO_COMPLETED',
])

const demoCases = Object.freeze([
  Object.freeze({
    requestId: 'execution-product-launch',
    prompt:
      'Create a 30 second product launch video for Nova Studio aimed at young customers.',
    category: 'marketing',
    requestedTemplate: 'product-launch-template-001',
    scenarioId: 'product-launch-showcase-001',
    workflowId: 'product-launch-workflow-001',
  }),
  Object.freeze({
    requestId: 'execution-education',
    prompt:
      'Create a 45 second tutorial video that teaches beginners an AI video workflow.',
    category: 'education',
    requestedTemplate: 'tutorial-video-template-001',
    scenarioId: 'tutorial-showcase-001',
    workflowId: 'tutorial-workflow-001',
  }),
  Object.freeze({
    requestId: 'execution-social-campaign',
    prompt:
      'Create a 15 second energetic TikTok social campaign short video.',
    category: 'social',
    requestedTemplate: 'social-campaign-template-001',
    scenarioId: 'social-campaign-showcase-001',
    workflowId: 'social-campaign-workflow-001',
  }),
])

const forbiddenFields = new Set([
  'artifactEnvelope',
  'artifactStatus',
  'runtimeDataV2',
  'runtimeContext',
  'providerResult',
  'productionJob',
  'productionAttempt',
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

function assertNoExecutionLeakage(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoExecutionLeakage(item, `${label}[${index}]`),
    )
    return
  }
  if (typeof value === 'string') {
    assert.notEqual(value, 'READY', `${label} contains a real READY state`)
    return
  }
  if (typeof value !== 'object' || value === null) {
    return
  }
  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      forbiddenFields.has(key),
      false,
      `${label} contains forbidden field ${key}`,
    )
    assertNoExecutionLeakage(child, `${label}.${key}`)
  }
}

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

try {
  const {
    createCommercialDemoExecutionSimulator,
    createCommercialDemoReport,
    createCommercialDemoService,
    createDemoRequest,
    createDemoShowcasePipeline,
    createProductionIntelligenceService,
    demoExecutionRegistry,
    extendCommercialDemoReport,
    productionWorkflowRegistry,
  } = await server.ssrLoadModule('/src/demo/index.ts')

  const registryStages = demoExecutionRegistry.getSimulationStages()
  assert.equal(Object.isFrozen(demoExecutionRegistry), true)
  assert.deepEqual(
    Object.keys(demoExecutionRegistry),
    ['getSimulationStages'],
  )
  assert.deepEqual(
    registryStages.map((stage) => stage.name),
    expectedStageNames,
  )
  assert.equal(
    new Set(registryStages.map((stage) => stage.stageId)).size,
    registryStages.length,
  )
  registryStages.forEach((stage) => {
    assert.deepEqual(Object.keys(stage), [
      'stageId',
      'name',
      'status',
      'description',
    ])
    assert.equal(stage.status, 'SIMULATED')
  })
  assertDeepFrozen(registryStages, 'registryStages')

  const intelligence = createProductionIntelligenceService()
  let intelligenceCalls = 0
  const intelligenceProbe = Object.freeze({
    generateScenario(prompt, requestedTemplateId) {
      intelligenceCalls += 1
      return intelligence.generateScenario(prompt, requestedTemplateId)
    },
  })
  let workflowReads = 0
  const workflowProbe = Object.freeze({
    getWorkflows() {
      workflowReads += 1
      return productionWorkflowRegistry.getWorkflows()
    },
  })
  const planningService = createCommercialDemoService(
    intelligenceProbe,
    workflowProbe,
  )

  let simulationStageReads = 0
  const simulationRegistryProbe = Object.freeze({
    getSimulationStages() {
      simulationStageReads += 1
      return demoExecutionRegistry.getSimulationStages()
    },
  })
  const simulator = createCommercialDemoExecutionSimulator(
    simulationRegistryProbe,
  )
  assert.equal(Object.isFrozen(simulator), true)
  assert.deepEqual(Object.keys(simulator), ['simulate'])

  const results = demoCases.map((demoCase) => {
    const input = {
      requestId: demoCase.requestId,
      prompt: demoCase.prompt,
      category: demoCase.category,
      requestedTemplate: demoCase.requestedTemplate,
      metadata: {
        commercialDemo: true,
        presentation: { mode: 'simulation' },
      },
    }
    const inputSnapshot = JSON.stringify(input)
    const request = createDemoRequest(input)
    const plan = planningService.createPlan(request)
    const planSnapshot = JSON.stringify(plan)
    const simulation = simulator.simulate(plan)

    assert.equal(JSON.stringify(input), inputSnapshot)
    assert.equal(JSON.stringify(plan), planSnapshot)
    assert.deepEqual(Object.keys(simulation), [
      'simulationId',
      'requestId',
      'scenarioId',
      'workflowId',
      'stages',
      'status',
    ])
    assert.equal(
      simulation.simulationId,
      `demo-execution-simulation-${demoCase.requestId}`,
    )
    assert.equal(simulation.requestId, demoCase.requestId)
    assert.equal(simulation.scenarioId, demoCase.scenarioId)
    assert.equal(simulation.workflowId, demoCase.workflowId)
    assert.equal(simulation.status, 'COMPLETED')
    assert.deepEqual(
      simulation.stages.map((stage) => stage.name),
      expectedStageNames,
    )
    assert.notEqual(simulation.stages, registryStages)
    assertDeepFrozen(simulation, `simulation:${demoCase.requestId}`)
    assertNoExecutionLeakage(
      simulation,
      `simulation:${demoCase.requestId}`,
    )

    return Object.freeze({ plan, simulation })
  })

  assert.equal(intelligenceCalls, demoCases.length)
  assert.equal(workflowReads, demoCases.length)
  assert.equal(simulationStageReads, demoCases.length)

  const pipeline = createDemoShowcasePipeline()
  const { plan, simulation } = results[0]
  const report = createCommercialDemoReport(plan, pipeline, simulation)
  assert.deepEqual(Object.keys(report), [
    'reportId',
    'requestSummary',
    'scenario',
    'workflow',
    'simulation',
    'pipeline',
  ])
  assert.equal(report.scenario, plan.scenario)
  assert.equal(report.workflow, plan.workflow)
  assert.equal(report.simulation, simulation)
  assert.equal(report.pipeline, pipeline)
  assertDeepFrozen(report, 'executionReport')
  assertNoExecutionLeakage(report, 'executionReport')

  const extendedReport = extendCommercialDemoReport(
    plan,
    pipeline,
    simulation,
  )
  assert.deepEqual(extendedReport, report)
  assertDeepFrozen(extendedReport, 'extendedReport')

  const legacyReport = createCommercialDemoReport(plan, pipeline)
  assert.deepEqual(Object.keys(legacyReport), [
    'reportId',
    'requestSummary',
    'selectedTemplate',
    'scenarioId',
    'workflowId',
    'pipeline',
  ])
  assert.equal(legacyReport.scenarioId, plan.scenario.scenarioId)
  assert.equal(legacyReport.workflowId, plan.workflow.workflowId)

  assert.throws(
    () =>
      createCommercialDemoReport(
        plan,
        pipeline,
        Object.freeze({
          ...simulation,
          workflowId: 'mismatched-workflow',
        }),
      ),
    TypeError,
  )

  const executionSources = await Promise.all([
    readSource('../src/demo/commercialExecution/types.ts'),
    readSource(
      '../src/demo/commercialExecution/stages/demoExecutionStages.ts',
    ),
    readSource(
      '../src/demo/commercialExecution/registry/executionRegistry.ts',
    ),
    readSource(
      '../src/demo/commercialExecution/simulation/createDemoExecutionSimulation.ts',
    ),
    readSource(
      '../src/demo/commercialExecution/service/createCommercialDemoExecutionSimulator.ts',
    ),
    readSource(
      '../src/demo/commercialExecution/report/extendCommercialDemoReport.ts',
    ),
    readSource('../src/demo/commercialExecution/index.ts'),
    readSource(
      '../src/demo/commercialDemo/report/createCommercialDemoReport.ts',
    ),
  ])
  const sourceText = executionSources.join('\n')
  for (const forbiddenImport of [
    "from '../../production/",
    "from '../../../production/",
    "from '../../artifacts/",
    "from '../../../artifacts/",
    "from '../../runtime/",
    "from '../../../runtime/",
    "from '../../providers/",
    "from '../../../providers/",
    "from '../../renderer/",
    "from '../../../renderer/",
  ]) {
    assert.equal(
      sourceText.includes(forbiddenImport),
      false,
      `Forbidden coupling import: ${forbiddenImport}`,
    )
  }
  for (const forbiddenSymbol of [
    'ProductionJob',
    'ProductionAttempt',
    'ArtifactEnvelope',
    'RuntimeDataV2',
    'RuntimeContext',
    'VideoProvider',
    'ProviderResult',
    'createProductionJob',
    'createProductionAttempt',
    'createArtifact',
    '.activate(',
    '.consume(',
    '.render(',
  ]) {
    assert.equal(
      sourceText.includes(forbiddenSymbol),
      false,
      `Forbidden coupling symbol: ${forbiddenSymbol}`,
    )
  }
  assert.equal(
    sourceText.includes('CommercialDemoPlan'),
    true,
    'Execution Simulation must consume the existing CommercialDemoPlan',
  )
  assert.equal(
    sourceText.includes('createCommercialDemoReport'),
    true,
    'Execution Simulation report must reuse the commercial report boundary',
  )

  console.log('Commercial Demo Execution Simulation Validation')
  console.log('1. Execution Contract: PASS')
  console.log('2. Stage Contract: PASS')
  console.log('3. Simulation Creation: PASS')
  console.log('4. Scenario Integration: PASS')
  console.log('5. Workflow Integration: PASS')
  console.log('6. Report Integration: PASS')
  console.log('7. Simulation Immutable: PASS')
  console.log('8. No Real Execution Leakage: PASS')
  console.log('9. Forbidden Coupling: PASS')
  console.log('10. Existing Demo Regression: PASS')
} finally {
  await server.close()
}
