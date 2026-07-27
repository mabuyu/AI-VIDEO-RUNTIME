import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const intentKeys = Object.freeze([
  'intentId',
  'rawPrompt',
  'category',
  'objective',
  'extractedRequirements',
])
const recommendationKeys = Object.freeze([
  'recommendationId',
  'templateId',
  'confidence',
  'reason',
])
const resultKeys = Object.freeze([
  'intent',
  'recommendation',
  'scenario',
])
const expectedPipeline = Object.freeze([
  'Production',
  'Artifact',
  'Runtime',
])

const cases = Object.freeze([
  Object.freeze({
    prompt: '制作一个30秒新能源汽车宣传视频，科技风，面向年轻用户',
    category: 'marketing',
    objective: 'product introduction',
    templateId: 'product-marketing-template-001',
    scenarioId: 'product-demo-001',
    duration: '30s',
    audience: 'young',
    style: 'technology',
  }),
  Object.freeze({
    prompt: '制作一个45秒光合作用科普视频，面向初学者',
    category: 'education',
    objective: 'concept explanation',
    templateId: 'education-video-template-001',
    scenarioId: 'education-demo-001',
    duration: '45s',
    audience: 'beginner',
    style: 'polished',
  }),
  Object.freeze({
    prompt: '制作一个15秒TikTok短视频，分享高效学习方法，活力风格',
    category: 'social',
    objective: 'audience engagement',
    templateId: 'social-video-template-001',
    scenarioId: 'social-demo-001',
    duration: '15s',
    audience: 'general audience',
    style: 'energetic',
  }),
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

try {
  const {
    createProductionIntelligenceService,
    createPromptIntent,
    createScenarioFromIntent,
    demoTemplateRegistry,
    productionWorkflowRegistry,
    recommendTemplate,
    validateDemoScenarioPack,
  } = await server.ssrLoadModule('/src/demo/index.ts')

  const originalTemplates = demoTemplateRegistry.getTemplates()
  const templateSnapshot = JSON.stringify(
    originalTemplates.map((template) => ({
      templateId: template.templateId,
      name: template.name,
      category: template.category,
      description: template.description,
      inputSchema: template.inputSchema,
      defaultProductionInput: template.defaultProductionInput,
    })),
  )
  let registryReadCount = 0
  const registryProbe = Object.freeze({
    getTemplates() {
      registryReadCount += 1
      return originalTemplates
    },
  })

  const intents = cases.map((testCase) => {
    const intent = createPromptIntent(testCase.prompt)
    assert.deepEqual(Object.keys(intent), intentKeys)
    assert.match(intent.intentId, /^prompt-intent-/)
    assert.equal(intent.rawPrompt, testCase.prompt)
    assert.equal(intent.category, testCase.category)
    assert.equal(intent.objective, testCase.objective)
    assert.equal(intent.extractedRequirements.duration, testCase.duration)
    assert.equal(intent.extractedRequirements.audience, testCase.audience)
    assert.equal(intent.extractedRequirements.style, testCase.style)
    assertDeepFrozen(intent, `intent:${testCase.category}`)
    return intent
  })
  assert.equal(new Set(intents.map((intent) => intent.intentId)).size, 3)
  assert.throws(() => createPromptIntent('  '), TypeError)

  const recommendations = intents.map((intent, index) => {
    const recommendation = recommendTemplate(intent, registryProbe)
    assert.deepEqual(Object.keys(recommendation), recommendationKeys)
    assert.equal(recommendation.templateId, cases[index].templateId)
    assert.equal(
      recommendation.recommendationId,
      `template-recommendation-${intent.intentId}`,
    )
    assert.equal(
      recommendation.confidence > 0 &&
        recommendation.confidence <= 1,
      true,
    )
    assert.equal(recommendation.reason.includes(intent.category), true)
    assertDeepFrozen(
      recommendation,
      `recommendation:${intent.category}`,
    )
    return recommendation
  })
  assert.equal(registryReadCount, 3)

  const generatedScenarios = intents.map((intent, index) => {
    const scenario = createScenarioFromIntent(
      intent,
      recommendations[index],
      registryProbe,
    )
    assert.equal(scenario.scenarioId, cases[index].scenarioId)
    assert.equal(scenario.category, intent.category)
    assert.deepEqual(scenario.expectedPipeline, expectedPipeline)
    assert.equal(
      scenario.productionInput.targetDurationSeconds,
      Number.parseFloat(intent.extractedRequirements.duration),
    )
    assertDeepFrozen(scenario, `scenario:${intent.category}`)
    return scenario
  })
  assert.equal(registryReadCount, 6)

  const scenarioValidation = validateDemoScenarioPack(
    Object.freeze(generatedScenarios),
  )
  assert.equal(scenarioValidation.ok, true)

  const workflowScenarioIds = new Set(
    productionWorkflowRegistry
      .getWorkflows()
      .map((workflow) => workflow.scenarioId),
  )
  for (const scenario of generatedScenarios) {
    assert.equal(
      workflowScenarioIds.has(scenario.scenarioId),
      true,
      `Generated Scenario lacks Workflow Contract: ${scenario.scenarioId}`,
    )
  }

  const service = createProductionIntelligenceService(registryProbe)
  assert.equal(Object.isFrozen(service), true)
  assert.deepEqual(Object.keys(service), ['generateScenario'])
  const generatedResult = service.generateScenario(cases[0].prompt)
  assert.deepEqual(Object.keys(generatedResult), resultKeys)
  assert.equal(generatedResult.intent.category, 'marketing')
  assert.equal(
    generatedResult.recommendation.templateId,
    'product-marketing-template-001',
  )
  assert.equal(generatedResult.scenario.scenarioId, 'product-demo-001')
  assertDeepFrozen(generatedResult, 'generatedResult')
  assert.equal(registryReadCount, 8)

  assert.equal(
    JSON.stringify(
      originalTemplates.map((template) => ({
        templateId: template.templateId,
        name: template.name,
        category: template.category,
        description: template.description,
        inputSchema: template.inputSchema,
        defaultProductionInput: template.defaultProductionInput,
      })),
    ),
    templateSnapshot,
    'Production Intelligence mutated the existing Template Registry data',
  )

  const existingDemoValidation = validateDemoScenarioPack(
    (
      await server.ssrLoadModule(
        '/src/demo/productionRuntimeDemo/scenarios.ts',
      )
    ).productionRuntimeDemoScenarios,
  )
  assert.equal(existingDemoValidation.ok, true)

  const intelligenceSources = await Promise.all([
    readSource('../src/demo/productionIntelligence/types.ts'),
    readSource(
      '../src/demo/productionIntelligence/intent/createPromptIntent.ts',
    ),
    readSource(
      '../src/demo/productionIntelligence/recommendation/recommendTemplate.ts',
    ),
    readSource(
      '../src/demo/productionIntelligence/generation/createScenarioFromIntent.ts',
    ),
    readSource(
      '../src/demo/productionIntelligence/service/createProductionIntelligenceService.ts',
    ),
    readSource('../src/demo/productionIntelligence/index.ts'),
  ])
  const sourceText = intelligenceSources.join('\n')
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
    'Renderer',
    'VideoProvider',
    'Provider API',
  ]) {
    assert.equal(
      sourceText.includes(forbiddenSymbol),
      false,
      `Forbidden coupling symbol: ${forbiddenSymbol}`,
    )
  }
  assert.equal(
    sourceText.includes('demoTemplateRegistry'),
    true,
    'Existing DemoTemplateRegistry must be reused',
  )
  assert.equal(
    sourceText.includes('createScenarioFromTemplate'),
    true,
    'Existing Scenario Builder must be reused',
  )

  console.log('Production Intelligence Validation')
  console.log('1. PromptIntent Contract: PASS')
  console.log('2. Intent Factory: PASS')
  console.log('3. Template Recommendation: PASS')
  console.log('4. Recommendation Registry reuse: PASS')
  console.log('5. Scenario Generation: PASS')
  console.log('6. Generated Scenario compatibility: PASS')
  console.log('7. Production Intelligence Service: PASS')
  console.log('8. Forbidden Coupling: PASS')
  console.log('9. Immutable Output: PASS')
  console.log('10. Existing Demo Platform Regression: PASS')
  console.log('Production Intelligence Layer: PASS')
} finally {
  await server.close()
}
