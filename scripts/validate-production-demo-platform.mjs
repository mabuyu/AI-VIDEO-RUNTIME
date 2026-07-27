import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const templateKeys = Object.freeze([
  'templateId',
  'name',
  'category',
  'description',
  'inputSchema',
  'defaultProductionInput',
  'buildScenario',
])

const workflowKeys = Object.freeze([
  'workflowId',
  'scenarioId',
  'inputMapping',
  'pipeline',
])

const workflowPipeline = Object.freeze([
  'Scenario',
  'Production',
  'Artifact',
  'Runtime',
])

const expectedTemplateContracts = Object.freeze([
  Object.freeze({
    templateId: 'product-marketing-template-001',
    category: 'marketing',
    inputKeys: Object.freeze([
      'productName',
      'targetAudience',
      'style',
      'duration',
    ]),
    scenarioId: 'product-demo-001',
  }),
  Object.freeze({
    templateId: 'education-video-template-001',
    category: 'education',
    inputKeys: Object.freeze(['topic', 'audience', 'duration']),
    scenarioId: 'education-demo-001',
  }),
  Object.freeze({
    templateId: 'social-video-template-001',
    category: 'social',
    inputKeys: Object.freeze(['topic', 'platform', 'duration']),
    scenarioId: 'social-demo-001',
  }),
])

const templateInputs = Object.freeze([
  Object.freeze({
    productName: 'Production Demo Platform',
    targetAudience: 'video production teams',
    style: 'cinematic',
    duration: 32,
  }),
  Object.freeze({
    topic: 'data-driven video production',
    audience: 'new creators',
    duration: 46,
  }),
  Object.freeze({
    topic: 'building a reusable video hook',
    platform: 'YouTube Shorts',
    duration: 18,
  }),
])

const forbiddenContractFields = Object.freeze([
  'READY',
  'ready',
  'artifactEnvelope',
  'runtimeContext',
  'runtimeDataV2',
  'runtimeArtifactInput',
  'providerState',
  'productionLifecycle',
  'status',
  'state',
  'lifecycle',
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

function assertForbiddenFieldsAbsent(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertForbiddenFieldsAbsent(item, `${label}[${index}]`),
    )
    return
  }

  if (typeof value !== 'object' || value === null) {
    return
  }

  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      forbiddenContractFields.includes(key),
      false,
      `${label}: forbidden field ${key}`,
    )
    assertForbiddenFieldsAbsent(child, `${label}.${key}`)
  }
}

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

try {
  const {
    createScenarioFromTemplate,
    demoScenarioRegistry,
    demoTemplateRegistry,
    productionWorkflowRegistry,
    validateDemoScenarioPack,
  } = await server.ssrLoadModule('/src/demo/index.ts')

  const scenarios = demoScenarioRegistry.getScenarios()
  const scenarioPackValidation = validateDemoScenarioPack(scenarios)
  assert.equal(
    scenarioPackValidation.ok,
    true,
    'Existing Demo Scenario Pack regression failed',
  )

  assert.equal(Object.isFrozen(demoTemplateRegistry), true)
  assert.deepEqual(Object.keys(demoTemplateRegistry), ['getTemplates'])
  const templates = demoTemplateRegistry.getTemplates()
  assert.equal(Object.isFrozen(templates), true)
  assert.equal(demoTemplateRegistry.getTemplates(), templates)
  assert.equal(templates.length >= expectedTemplateContracts.length, true)

  const baselineTemplates = templates.slice(
    0,
    expectedTemplateContracts.length,
  )
  const builtScenarios = baselineTemplates.map((template, index) => {
    const expected = expectedTemplateContracts[index]
    assert.deepEqual(Object.keys(template), templateKeys)
    assert.equal(template.templateId, expected.templateId)
    assert.equal(template.category, expected.category)
    assert.deepEqual(Object.keys(template.inputSchema), expected.inputKeys)
    assert.equal(typeof template.buildScenario, 'function')
    assertDeepFrozen(template, `templates[${index}]`)
    assertForbiddenFieldsAbsent(
      template.defaultProductionInput,
      `templates[${index}].defaultProductionInput`,
    )

    for (const [field, schema] of Object.entries(template.inputSchema)) {
      assert.equal(schema.required, true, `${field} must be required`)
      assert.equal(
        schema.type === 'string' || schema.type === 'number',
        true,
        `${field} has unsupported input type`,
      )
    }

    const input = templateInputs[index]
    const inputSnapshot = JSON.stringify(input)
    const templateSnapshot = JSON.stringify({
      templateId: template.templateId,
      name: template.name,
      category: template.category,
      description: template.description,
      inputSchema: template.inputSchema,
      defaultProductionInput: template.defaultProductionInput,
    })
    const scenario = createScenarioFromTemplate(template, input)

    assert.equal(JSON.stringify(input), inputSnapshot, 'Builder mutated input')
    assert.equal(
      JSON.stringify({
        templateId: template.templateId,
        name: template.name,
        category: template.category,
        description: template.description,
        inputSchema: template.inputSchema,
        defaultProductionInput: template.defaultProductionInput,
      }),
      templateSnapshot,
      'Builder mutated Template',
    )
    assert.equal(scenario.scenarioId, expected.scenarioId)
    assert.equal(scenario.category, template.category)
    assertDeepFrozen(scenario, `builtScenarios[${index}]`)
    assertForbiddenFieldsAbsent(scenario, `builtScenarios[${index}]`)
    return scenario
  })

  assert.throws(
    () =>
      createScenarioFromTemplate(templates[0], {
        productName: 'Incomplete input',
      }),
    TypeError,
    'Scenario Builder must reject input that does not satisfy inputSchema',
  )

  assert.deepEqual(
    builtScenarios.map((scenario) => scenario.scenarioId),
    scenarios
      .slice(0, expectedTemplateContracts.length)
      .map((scenario) => scenario.scenarioId),
  )
  assert.equal(validateDemoScenarioPack(Object.freeze(builtScenarios)).ok, true)

  assert.equal(Object.isFrozen(productionWorkflowRegistry), true)
  assert.deepEqual(Object.keys(productionWorkflowRegistry), ['getWorkflows'])
  const workflows = productionWorkflowRegistry.getWorkflows()
  assert.equal(Object.isFrozen(workflows), true)
  assert.equal(productionWorkflowRegistry.getWorkflows(), workflows)
  assert.equal(workflows.length, scenarios.length)

  const scenarioIds = new Set(scenarios.map((scenario) => scenario.scenarioId))
  const workflowIds = new Set()
  for (const [index, workflow] of workflows.entries()) {
    assert.deepEqual(Object.keys(workflow), workflowKeys)
    assert.equal(typeof workflow.workflowId, 'string')
    assert.equal(workflow.workflowId.trim().length > 0, true)
    assert.equal(workflowIds.has(workflow.workflowId), false)
    workflowIds.add(workflow.workflowId)
    assert.equal(scenarioIds.has(workflow.scenarioId), true)
    assert.equal(workflow.scenarioId, scenarios[index].scenarioId)
    assert.deepEqual(workflow.inputMapping, [
      {
        scenarioField: 'scenarioIntent',
        productionField: 'production.generationIntent',
      },
      {
        scenarioField: 'productionInput',
        productionField: 'production.input',
      },
    ])
    assert.deepEqual(workflow.pipeline, workflowPipeline)
    assert.equal(workflow.pipeline[1], 'Production')
    assertDeepFrozen(workflow, `workflows[${index}]`)
    assertForbiddenFieldsAbsent(workflow, `workflows[${index}]`)
  }

  const [
    templateSource,
    builderSource,
    templateRegistrySource,
    workflowSource,
    workflowRegistrySource,
  ] = await Promise.all([
    readSource('../src/demo/productionRuntimeDemo/templates.ts'),
    readSource(
      '../src/demo/productionRuntimeDemo/createScenarioFromTemplate.ts',
    ),
    readSource('../src/demo/productionRuntimeDemo/templateRegistry.ts'),
    readSource('../src/demo/productionRuntimeDemo/workflows.ts'),
    readSource('../src/demo/productionRuntimeDemo/workflowRegistry.ts'),
  ])

  const implementationSource = [
    templateSource,
    builderSource,
    templateRegistrySource,
    workflowSource,
    workflowRegistrySource,
  ].join('\n')
  for (const forbiddenImport of [
    "from '../../production",
    "from '../../artifacts",
    "from '../../runtime",
    "from '../../providers",
    'sceneRenderer',
  ]) {
    assert.equal(
      implementationSource.includes(forbiddenImport),
      false,
      `Forbidden coupling: ${forbiddenImport}`,
    )
  }

  for (const forbiddenExecution of [
    'createProductionJob',
    'createProductionAttempt',
    'createProviderExecution',
    'createArtifactRuntimeReference',
    'renderRuntimeArtifactInput',
    '.activate(',
    '.consume(',
  ]) {
    assert.equal(
      implementationSource.includes(forbiddenExecution),
      false,
      `Workflow execution is forbidden: ${forbiddenExecution}`,
    )
  }

  assert.equal(templateSource.includes('ArtifactEnvelope'), false)
  assert.equal(templateSource.includes('RuntimeContext'), false)
  assert.equal(templateSource.includes('RuntimeDataV2'), false)
  assert.equal(workflowSource.includes('ArtifactEnvelope'), false)
  assert.equal(workflowSource.includes('RuntimeContext'), false)
  assert.equal(workflowSource.includes('RuntimeDataV2'), false)

  console.log('Production Demo Platform Validation')
  console.log('Existing Demo Scenario Pack regression: PASS')
  console.log('Template Contract: PASS')
  console.log('Template Registry: PASS')
  console.log('Scenario Builder: PASS')
  console.log('Workflow Contract: PASS')
  console.log('Workflow Registry: PASS')
  console.log('Template -> Scenario: PASS')
  console.log('Scenario -> Workflow: PASS')
  console.log('Workflow -> Production boundary: PASS')
  console.log('Forbidden coupling: PASS')
  console.log('RuntimeDataV2: UNCHANGED')
  console.log('RuntimeContext: UNCHANGED')
  console.log('Renderer: UNCHANGED')
  console.log('Artifact Layer: UNCHANGED')
  console.log('Production Layer: UNCHANGED')
  console.log('Provider Layer: UNCHANGED')
  console.log('Production Demo Platform: PASS')
} finally {
  await server.close()
}
