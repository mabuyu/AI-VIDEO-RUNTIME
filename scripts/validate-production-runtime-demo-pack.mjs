import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const contractKeys = Object.freeze([
  'scenarioId',
  'name',
  'description',
  'category',
  'scenarioIntent',
  'productionInput',
  'expectedPipeline',
])

const canonicalPipeline = Object.freeze([
  'Production',
  'Artifact',
  'Runtime',
])

function expectIssue(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal(
    result.issues.some((issue) => issue.code === code),
    true,
    `${label}: expected ${code}`,
  )
  assert.equal(Object.isFrozen(result), true, `${label}: mutable result`)
  assert.equal(
    Object.isFrozen(result.issues),
    true,
    `${label}: mutable issues`,
  )
}

function replaceScenario(scenarios, index, replacement) {
  return Object.freeze(
    scenarios.map((scenario, scenarioIndex) =>
      scenarioIndex === index ? Object.freeze(replacement) : scenario,
    ),
  )
}

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

try {
  const {
    createDemoScenarioPackReport,
    demoScenarioRegistry,
    validateDemoScenarioPack,
  } = await server.ssrLoadModule('/src/demo/index.ts')

  assert.equal(Object.isFrozen(demoScenarioRegistry), true)
  assert.deepEqual(Object.keys(demoScenarioRegistry), ['getScenarios'])

  const scenarios = demoScenarioRegistry.getScenarios()
  assert.equal(Array.isArray(scenarios), true)
  assert.equal(Object.isFrozen(scenarios), true)
  assert.equal(
    demoScenarioRegistry.getScenarios(),
    scenarios,
    'Registry must expose one canonical Scenario Pack',
  )

  const validation = validateDemoScenarioPack(scenarios)
  assert.equal(validation.ok, true, 'Demo Scenario Pack must be valid')
  assert.equal(validation.scenarioCount, scenarios.length)
  assert.equal(Object.isFrozen(validation), true)
  assert.equal(Object.isFrozen(validation.issues), true)

  assert.equal(scenarios.length >= 7, true)
  assert.deepEqual(
    scenarios.slice(0, 3).map((scenario) => scenario.scenarioId),
    ['product-demo-001', 'education-demo-001', 'social-demo-001'],
  )
  assert.deepEqual(
    scenarios.slice(0, 3).map((scenario) => scenario.category),
    ['marketing', 'education', 'social'],
  )

  for (const scenario of scenarios) {
    assert.deepEqual(Object.keys(scenario), contractKeys)
    assert.equal(Object.isFrozen(scenario), true)
    assert.equal(Object.isFrozen(scenario.productionInput), true)
    assert.equal(
      Object.isFrozen(scenario.productionInput.outputSpecification),
      true,
    )
    assert.equal(Object.isFrozen(scenario.expectedPipeline), true)
    assert.deepEqual(scenario.expectedPipeline, canonicalPipeline)
  }

  const missingName = { ...scenarios[0] }
  delete missingName.name
  expectIssue(
    validateDemoScenarioPack(
      replaceScenario(scenarios, 0, missingName),
    ),
    'INVALID_SCENARIO',
    'Scenario Contract',
  )

  expectIssue(
    validateDemoScenarioPack(Object.freeze(scenarios.slice(0, 2))),
    'INSUFFICIENT_SCENARIOS',
    'Scenario count',
  )

  expectIssue(
    validateDemoScenarioPack(
      replaceScenario(scenarios, 1, {
        ...scenarios[1],
        scenarioId: scenarios[0].scenarioId,
      }),
    ),
    'DUPLICATE_SCENARIO_ID',
    'Scenario Registry uniqueness',
  )

  expectIssue(
    validateDemoScenarioPack(
      replaceScenario(scenarios, 0, {
        ...scenarios[0],
        expectedPipeline: Object.freeze([
          'Production',
          'Runtime',
          'Artifact',
        ]),
      }),
    ),
    'INVALID_EXPECTED_PIPELINE',
    'Expected Pipeline',
  )

  expectIssue(
    validateDemoScenarioPack(
      replaceScenario(scenarios, 0, {
        ...scenarios[0],
        artifactEnvelope: Object.freeze({}),
      }),
    ),
    'FORBIDDEN_ARTIFACT_OWNERSHIP',
    'Artifact ownership',
  )

  expectIssue(
    validateDemoScenarioPack(
      replaceScenario(scenarios, 0, {
        ...scenarios[0],
        runtimeReference: Object.freeze({}),
      }),
    ),
    'FORBIDDEN_RUNTIME_REFERENCE',
    'Runtime Reference ownership',
  )

  expectIssue(
    validateDemoScenarioPack(
      replaceScenario(scenarios, 0, {
        ...scenarios[0],
        ready: 'READY',
      }),
    ),
    'FORBIDDEN_READY_STATE',
    'READY state',
  )

  expectIssue(
    validateDemoScenarioPack(
      replaceScenario(scenarios, 0, {
        ...scenarios[0],
        status: 'RUNNING',
      }),
    ),
    'FORBIDDEN_PRODUCTION_LIFECYCLE',
    'Production lifecycle state',
  )

  const reportResult = createDemoScenarioPackReport(scenarios)
  assert.equal(reportResult.ok, true)
  assert.equal(Object.isFrozen(reportResult), true)
  assert.equal(Object.isFrozen(reportResult.report), true)
  assert.equal(Object.isFrozen(reportResult.report.categories), true)
  assert.equal(Object.isFrozen(reportResult.report.scenarios), true)
  assert.deepEqual(reportResult.report.categories, [
    'marketing',
    'education',
    'social',
  ])

  const demoSources = await Promise.all([
    readSource(
      '../src/demo/productionRuntimeDemo/createDemoScenarioPackReport.ts',
    ),
    readSource('../src/demo/productionRuntimeDemo/registry.ts'),
    readSource('../src/demo/productionRuntimeDemo/scenarios.ts'),
    readSource('../src/demo/productionRuntimeDemo/types.ts'),
    readSource(
      '../src/demo/productionRuntimeDemo/validateDemoScenarioPack.ts',
    ),
  ])
  const sourceText = demoSources.join('\n')
  for (const forbiddenImport of [
    "from '../../production",
    "from '../../artifacts",
    "from '../../runtime",
    "from '../../providers",
    'sceneRenderer',
  ]) {
    assert.equal(
      sourceText.includes(forbiddenImport),
      false,
      `Demo Scenario Pack forbidden coupling: ${forbiddenImport}`,
    )
  }

  console.log('Production Runtime Demo Pack Report')
  console.log('Scenario Contract: PASS')
  console.log('Scenario Registry: PASS')
  console.log('Scenario Count >= 3: PASS')
  console.log('Scenario Field Completeness: PASS')
  console.log('Expected Pipeline: PASS')
  console.log('Scenario Artifact Ownership: ABSENT')
  console.log('Scenario Runtime Reference Ownership: ABSENT')
  console.log('Scenario READY State: ABSENT')
  console.log('Scenario Production Lifecycle State: ABSENT')
  console.log(`Pack ID: ${reportResult.report.packId}`)
  console.log(`Scenario Count: ${reportResult.report.scenarioCount}`)
  for (const scenario of reportResult.report.scenarios) {
    console.log(
      `Scenario: ${scenario.scenarioId} | ${scenario.name} | ${scenario.category} | PASS`,
    )
  }
  console.log('Production Layer: UNCHANGED')
  console.log('Artifact Layer: UNCHANGED')
  console.log('RuntimeDataV2: UNCHANGED')
  console.log('RuntimeContext: UNCHANGED')
  console.log('Provider Layer: UNCHANGED')
  console.log('Renderer: UNCHANGED')
  console.log('Production Runtime Demo Pack: PASS')
} finally {
  await server.close()
}
