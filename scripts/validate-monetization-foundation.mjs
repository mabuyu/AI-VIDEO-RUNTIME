import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const monetizationSourceFiles = Object.freeze([
  '../src/demo/monetization/types.ts',
  '../src/demo/monetization/productionTiers.ts',
  '../src/demo/monetization/usagePlans.ts',
  '../src/demo/monetization/commercialPackages.ts',
  '../src/demo/monetization/service/createCommercialPackageService.ts',
  '../src/demo/monetization/index.ts',
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
  const demo = await server.ssrLoadModule('/src/demo/index.ts')
  const {
    createCommercialPackageService,
    createCustomerDemoExperienceService,
    createDemoRequest,
    getCommercialPackages,
    getProductionTiers,
    getUsagePlans,
  } = demo

  const tiers = getProductionTiers()
  assert.deepEqual(
    tiers.map((tier) => tier.name),
    ['Basic', 'Standard', 'Professional', 'Enterprise'],
  )
  for (const tier of tiers) {
    assert.deepEqual(Object.keys(tier), [
      'tierId',
      'name',
      'capabilityLevel',
      'maxDuration',
      'maxScenes',
      'complexityLevel',
    ])
    assert.equal(tier.maxDuration > 0, true)
    assert.equal(tier.maxScenes > 0, true)
  }
  assertDeepFrozen(tiers, 'productionTiers')

  const plans = getUsagePlans()
  assert.deepEqual(
    plans.map((plan) => plan.name),
    ['Starter', 'Creator', 'Business'],
  )
  for (const plan of plans) {
    assert.deepEqual(Object.keys(plan), [
      'planId',
      'name',
      'monthlyCredits',
      'demoSessions',
      'simulationQuota',
    ])
    assert.equal(plan.monthlyCredits > 0, true)
    assert.equal(plan.demoSessions > 0, true)
    assert.equal(plan.simulationQuota > 0, true)
  }
  assertDeepFrozen(plans, 'usagePlans')

  const packages = getCommercialPackages()
  assert.equal(packages.length, 4)
  for (const commercialPackage of packages) {
    assert.deepEqual(Object.keys(commercialPackage), [
      'packageId',
      'name',
      'plan',
      'tier',
      'capabilities',
    ])
    assert.equal(plans.includes(commercialPackage.plan), true)
    assert.equal(tiers.includes(commercialPackage.tier), true)
    assert.equal(commercialPackage.capabilities.length > 0, true)
  }
  const businessPackage = packages.find(
    (commercialPackage) =>
      commercialPackage.packageId === 'business-ai-video-package',
  )
  assert.notEqual(businessPackage, undefined)
  assert.equal(businessPackage.name, 'Business AI Video Package')
  assert.equal(businessPackage.plan.name, 'Business')
  assert.equal(businessPackage.tier.name, 'Professional')
  assert.deepEqual(businessPackage.capabilities, [
    'Marketing Templates',
    'Education Templates',
    'Social Templates',
    'Premium Simulation',
  ])
  assertDeepFrozen(packages, 'commercialPackages')

  const service = createCommercialPackageService()
  assert.equal(Object.isFrozen(service), true)
  assert.deepEqual(Object.keys(service), [
    'getProductionTiers',
    'getUsagePlans',
    'getPackages',
    'recommendPackage',
  ])
  assert.equal(service.getProductionTiers(), tiers)
  assert.equal(service.getUsagePlans(), plans)
  assert.equal(service.getPackages(), packages)

  const recommendations = [
    service.recommendPackage({
      category: 'marketing',
      estimatedDurationSeconds: 10,
      estimatedSceneCount: 3,
      complexityLevel: 'low',
      requiresPremiumSimulation: false,
    }),
    service.recommendPackage({
      category: 'education',
      estimatedDurationSeconds: 30,
      estimatedSceneCount: 5,
      complexityLevel: 'medium',
      requiresPremiumSimulation: false,
    }),
    service.recommendPackage({
      category: 'marketing',
      estimatedDurationSeconds: 60,
      estimatedSceneCount: 8,
      complexityLevel: 'medium',
      requiresPremiumSimulation: true,
    }),
    service.recommendPackage({
      category: 'social',
      estimatedDurationSeconds: 240,
      estimatedSceneCount: 40,
      complexityLevel: 'high',
      requiresPremiumSimulation: true,
    }),
  ]
  assert.deepEqual(
    recommendations.map((recommendation) => recommendation.tier.name),
    ['Basic', 'Standard', 'Professional', 'Enterprise'],
  )
  recommendations.forEach((recommendation, index) =>
    assertDeepFrozen(recommendation, `recommendations[${index}]`),
  )
  assert.throws(
    () =>
      service.recommendPackage({
        category: 'marketing',
        estimatedDurationSeconds: 1000,
        estimatedSceneCount: 100,
        complexityLevel: 'high',
        requiresPremiumSimulation: true,
      }),
    RangeError,
  )

  const experience = createCustomerDemoExperienceService({
    createSessionId: () => 'monetization-validation-session',
  }).createDemoExperience({
    request: createDemoRequest({
      requestId: 'monetization-validation-request',
      prompt:
        'Create a 30 second technology product launch video for young users.',
      category: 'marketing',
      requestedTemplate: 'product-launch-template-001',
    }),
  })
  assert.equal(
    experience.presentation.packageRecommendationSummary.packageId,
    'business-ai-video-package',
  )
  assert.equal(
    experience.presentation.packageRecommendationSummary.tierName,
    'Professional',
  )
  assertDeepFrozen(experience, 'customerExperience')

  const sourceText = (
    await Promise.all(monetizationSourceFiles.map(readSource))
  ).join('\n')
  const importSpecifiers = [
    ...sourceText.matchAll(/from\s+['"]([^'"]+)['"]/g),
  ].map((match) => match[1])
  for (const specifier of importSpecifiers) {
    assert.equal(
      /\/(?:runtime|runtimeData|artifacts|production|providers)(?:\/|$)/.test(
        specifier,
      ),
      false,
      `Forbidden Monetization import: ${specifier}`,
    )
  }
  for (const forbiddenSymbol of [
    'ProductionJob',
    'ProductionAttempt',
    'ArtifactEnvelope',
    'ArtifactRuntimeReference',
    'RuntimeDataV2',
    'RuntimeContext',
    'VideoProvider',
    'createProductionJob',
    'createArtifact',
    '.activate(',
    '.consume(',
    '.render(',
    'payment',
    'database',
    'billing',
  ]) {
    assert.equal(
      sourceText.toLowerCase().includes(forbiddenSymbol.toLowerCase()),
      false,
      `Forbidden Monetization symbol: ${forbiddenSymbol}`,
    )
  }
  assert.equal(
    /(?:class|const|function|interface|type)\s+\w*(?:Template|Scenario|Workflow)Registry/.test(
      sourceText,
    ),
    false,
    'Monetization must not duplicate an existing Registry',
  )

  await access(new URL('../dist/index.html', import.meta.url))

  console.log('Monetization Foundation Validation')
  console.log('1. ProductionTier Contract: PASS')
  console.log('2. UsagePlan Contract: PASS')
  console.log('3. CommercialPackage Contract: PASS')
  console.log('4. Package Service: PASS')
  console.log('5. Recommendation: PASS')
  console.log('6. Immutable Output: PASS')
  console.log('7. Existing Demo Regression: PASS')
  console.log('8. Forbidden Coupling: PASS')
  console.log('9. Runtime Isolation: PASS')
  console.log('10. Build: PASS')
} finally {
  await server.close()
}
