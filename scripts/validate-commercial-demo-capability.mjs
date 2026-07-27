import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const showcaseCases = Object.freeze([
  Object.freeze({
    requestId: 'request-product-launch',
    prompt:
      '制作一个30秒产品宣传视频，为年轻用户发布 Nova Studio，电影风格',
    category: 'marketing',
    requestedTemplate: 'product-launch-template-001',
    scenarioId: 'product-launch-showcase-001',
    scenarioName: 'Product Launch Video',
    workflowId: 'product-launch-workflow-001',
  }),
  Object.freeze({
    requestId: 'request-brand-story',
    prompt: '制作一个45秒品牌故事视频，面向企业客户，极简风格',
    category: 'marketing',
    requestedTemplate: 'brand-story-template-001',
    scenarioId: 'brand-story-showcase-001',
    scenarioName: 'Brand Story Video',
    workflowId: 'brand-story-workflow-001',
  }),
  Object.freeze({
    requestId: 'request-tutorial',
    prompt: '制作一个45秒教程视频，教初学者建立 AI 视频工作流',
    category: 'education',
    requestedTemplate: 'tutorial-video-template-001',
    scenarioId: 'tutorial-showcase-001',
    scenarioName: 'Tutorial Video',
    workflowId: 'tutorial-workflow-001',
  }),
  Object.freeze({
    requestId: 'request-social-campaign',
    prompt: '制作一个15秒TikTok社交活动短视频，活力风格',
    category: 'social',
    requestedTemplate: 'social-campaign-template-001',
    scenarioId: 'social-campaign-showcase-001',
    scenarioName: 'Social Campaign Video',
    workflowId: 'social-campaign-workflow-001',
  }),
])

const showcaseStages = Object.freeze([
  'Prompt',
  'Intent',
  'Template',
  'Scenario',
  'Workflow',
  'Production',
  'Artifact',
  'Runtime',
])

const forbiddenFields = new Set([
  'artifactEnvelope',
  'ready',
  'runtimeDataV2',
  'runtimeContext',
  'providerState',
  'productionState',
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

function assertForbiddenContentAbsent(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertForbiddenContentAbsent(item, `${label}[${index}]`),
    )
    return
  }
  if (typeof value === 'string') {
    assert.notEqual(value, 'READY', `${label} contains forbidden state`)
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
    assertForbiddenContentAbsent(child, `${label}.${key}`)
  }
}

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

try {
  const {
    commercialScenarioLibrary,
    createCommercialDemoReport,
    createCommercialDemoService,
    createDemoRequest,
    createDemoShowcasePipeline,
    createProductionIntelligenceService,
    demoScenarioRegistry,
    demoTemplateRegistry,
    productionWorkflowRegistry,
    validateDemoScenarioPack,
  } = await server.ssrLoadModule('/src/demo/index.ts')

  const requestInput = {
    ...showcaseCases[0],
    metadata: {
      title: 'Launch showcase',
      audience: Object.freeze(['sales', 'partners']),
      display: Object.freeze({ featured: true, order: 1 }),
    },
  }
  const requestSnapshot = JSON.stringify(requestInput)
  const request = createDemoRequest(requestInput)
  assert.equal(JSON.stringify(requestInput), requestSnapshot)
  assert.deepEqual(Object.keys(request), [
    'requestId',
    'prompt',
    'category',
    'requestedTemplate',
    'metadata',
  ])
  assertDeepFrozen(request, 'request')
  assert.throws(
    () =>
      createDemoRequest({
        requestId: '',
        prompt: 'valid prompt',
        category: 'marketing',
      }),
    TypeError,
  )

  const intelligence = createProductionIntelligenceService()
  let intelligenceCallCount = 0
  const intelligenceProbe = Object.freeze({
    generateScenario(prompt, requestedTemplateId) {
      intelligenceCallCount += 1
      return intelligence.generateScenario(prompt, requestedTemplateId)
    },
  })
  const service = createCommercialDemoService(
    intelligenceProbe,
    productionWorkflowRegistry,
  )
  assert.equal(Object.isFrozen(service), true)
  assert.deepEqual(Object.keys(service), ['createPlan'])

  const plans = showcaseCases.map((showcaseCase) => {
    const demoRequest = createDemoRequest({
      requestId: showcaseCase.requestId,
      prompt: showcaseCase.prompt,
      category: showcaseCase.category,
      requestedTemplate: showcaseCase.requestedTemplate,
      metadata: { showcase: true },
    })
    const plan = service.createPlan(demoRequest)
    assert.deepEqual(Object.keys(plan), [
      'request',
      'intent',
      'recommendation',
      'scenario',
      'workflow',
    ])
    assert.equal(plan.request, demoRequest)
    assert.equal(
      plan.recommendation.templateId,
      showcaseCase.requestedTemplate,
    )
    assert.equal(plan.scenario.scenarioId, showcaseCase.scenarioId)
    assert.equal(plan.workflow.workflowId, showcaseCase.workflowId)
    assert.equal(plan.workflow.scenarioId, plan.scenario.scenarioId)
    assert.deepEqual(plan.workflow.pipeline, [
      'Scenario',
      'Production',
      'Artifact',
      'Runtime',
    ])
    assertDeepFrozen(plan, `plan:${showcaseCase.scenarioId}`)
    assertForbiddenContentAbsent(plan, `plan:${showcaseCase.scenarioId}`)
    return plan
  })
  assert.equal(intelligenceCallCount, showcaseCases.length)

  const templates = demoTemplateRegistry.getTemplates()
  const registryScenarios = demoScenarioRegistry.getScenarios()
  const registryWorkflows = productionWorkflowRegistry.getWorkflows()
  assert.equal(validateDemoScenarioPack(registryScenarios).ok, true)
  assert.equal(
    new Set(registryScenarios.map((scenario) => scenario.scenarioId)).size,
    registryScenarios.length,
  )

  assert.equal(Object.isFrozen(commercialScenarioLibrary), true)
  assert.equal(commercialScenarioLibrary.length, showcaseCases.length)
  commercialScenarioLibrary.forEach((scenario, index) => {
    const expected = showcaseCases[index]
    assert.equal(scenario.scenarioId, expected.scenarioId)
    assert.equal(scenario.name, expected.scenarioName)
    assert.equal(scenario.category, expected.category)
    assert.equal(
      registryScenarios.find(
        (candidate) => candidate.scenarioId === scenario.scenarioId,
      ),
      scenario,
      'Commercial library must reference the existing Scenario Registry',
    )
    assert.equal(
      templates.some(
        (template) =>
          template.templateId === expected.requestedTemplate &&
          template.category === scenario.category,
      ),
      true,
    )
    assert.equal(
      registryWorkflows.some(
        (workflow) =>
          workflow.workflowId === expected.workflowId &&
          workflow.scenarioId === scenario.scenarioId,
      ),
      true,
    )
    assertDeepFrozen(scenario, `commercialScenarioLibrary[${index}]`)
  })

  const pipeline = createDemoShowcasePipeline()
  assert.deepEqual(Object.keys(pipeline), ['pipelineId', 'stages'])
  assert.equal(pipeline.pipelineId, 'commercial-demo-showcase-pipeline-v1')
  assert.deepEqual(pipeline.stages, showcaseStages)
  assertDeepFrozen(pipeline, 'pipeline')

  const report = createCommercialDemoReport(plans[0], pipeline)
  assert.deepEqual(Object.keys(report), [
    'reportId',
    'requestSummary',
    'selectedTemplate',
    'scenarioId',
    'workflowId',
    'pipeline',
  ])
  assert.equal(
    report.reportId,
    `commercial-demo-report-${plans[0].request.requestId}`,
  )
  assert.equal(
    report.selectedTemplate,
    showcaseCases[0].requestedTemplate,
  )
  assert.equal(report.scenarioId, showcaseCases[0].scenarioId)
  assert.equal(report.workflowId, showcaseCases[0].workflowId)
  assert.equal(report.pipeline, pipeline)
  assertDeepFrozen(report, 'report')
  assertForbiddenContentAbsent(report, 'report')

  const commercialSources = await Promise.all([
    readSource('../src/demo/commercialDemo/types.ts'),
    readSource(
      '../src/demo/commercialDemo/request/createDemoRequest.ts',
    ),
    readSource(
      '../src/demo/commercialDemo/service/createCommercialDemoService.ts',
    ),
    readSource(
      '../src/demo/commercialDemo/pipeline/createDemoShowcasePipeline.ts',
    ),
    readSource(
      '../src/demo/commercialDemo/library/commercialScenarioLibrary.ts',
    ),
    readSource(
      '../src/demo/commercialDemo/report/createCommercialDemoReport.ts',
    ),
    readSource('../src/demo/commercialDemo/index.ts'),
  ])
  const sourceText = commercialSources.join('\n')
  for (const forbiddenImport of [
    "from '../../production/",
    "from '../../../production/",
    "from '../../artifacts/",
    "from '../../../artifacts/",
    "from '../../runtime/",
    "from '../../../runtime/",
    "from '../../providers/",
    "from '../../../providers/",
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
    'createProductionJob',
    'createProductionAttempt',
    'createArtifactRuntimeReference',
    '.activate(',
    '.consume(',
  ]) {
    assert.equal(
      sourceText.includes(forbiddenSymbol),
      false,
      `Forbidden coupling symbol: ${forbiddenSymbol}`,
    )
  }
  assert.equal(
    sourceText.includes('createProductionIntelligenceService'),
    true,
    'Commercial Demo must reuse Production Intelligence',
  )
  assert.equal(
    sourceText.includes('demoScenarioRegistry'),
    true,
    'Commercial Scenario Library must reuse DemoScenarioRegistry',
  )
  assert.equal(
    sourceText.includes('productionWorkflowRegistry'),
    true,
    'Commercial Demo must reuse Workflow Registry',
  )

  console.log('Commercial Demo Capability Validation')
  console.log('1. Demo Request Contract: PASS')
  console.log('2. Commercial Demo Service: PASS')
  console.log('3. WP-B integration: PASS')
  console.log('4. Template reuse: PASS')
  console.log('5. Scenario reuse: PASS')
  console.log('6. Workflow Contract compatibility: PASS')
  console.log('7. Showcase Pipeline: PASS')
  console.log('8. Commercial Scenario Library: PASS')
  console.log('9. Demo Report: PASS')
  console.log('10. Forbidden Coupling: PASS')
} finally {
  await server.close()
}
