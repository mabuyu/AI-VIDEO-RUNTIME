import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const scenario = Object.freeze({
  scenarioId: 'production-runtime-scenario-001',
  scenarioIntent:
    'Produce a five-second cinematic video and play the activated result',
  productionInput: Object.freeze({
    commandId: 'command-scenario-001',
    jobId: 'job-scenario-001',
    attemptId: 'attempt-scenario-001',
    activationId: 'activation-scenario-001',
    provider: 'scenario-provider',
    providerRequestId: 'provider-request-scenario-001',
    generationId: 'generation-scenario-001',
    outputSpecification: Object.freeze({
      mediaType: 'video',
      format: 'video/mp4',
    }),
  }),
  expectedPipeline: Object.freeze([
    'Production',
    'Artifact',
    'Runtime',
  ]),
})

const timestamps = Object.freeze({
  created: '2026-07-26T09:00:00.000Z',
  scheduled: '2026-07-26T09:00:01.000Z',
  jobRunning: '2026-07-26T09:00:02.000Z',
  attemptRunning: '2026-07-26T09:00:03.000Z',
  attemptCompleted: '2026-07-26T09:00:04.000Z',
  jobCompleted: '2026-07-26T09:00:05.000Z',
})

const artifactId = 'artifact-scenario-001'
const artifactPath =
  'output/artifacts/videos/artifact-scenario-001.mp4'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasExactKeys(value, expectedKeys) {
  return (
    isRecord(value) &&
    Object.keys(value).length === expectedKeys.length &&
    Object.keys(value).every((key) => expectedKeys.includes(key))
  )
}

function validateScenarioValidationCase(candidate) {
  if (
    !hasExactKeys(candidate, [
      'scenarioId',
      'scenarioIntent',
      'productionInput',
      'expectedPipeline',
    ]) ||
    !isNonEmptyString(candidate.scenarioId) ||
    !isNonEmptyString(candidate.scenarioIntent)
  ) {
    return false
  }

  const productionInput = candidate.productionInput
  if (
    !hasExactKeys(productionInput, [
      'commandId',
      'jobId',
      'attemptId',
      'activationId',
      'provider',
      'providerRequestId',
      'generationId',
      'outputSpecification',
    ]) ||
    ![
      productionInput.commandId,
      productionInput.jobId,
      productionInput.attemptId,
      productionInput.activationId,
      productionInput.provider,
      productionInput.providerRequestId,
      productionInput.generationId,
    ].every(isNonEmptyString) ||
    !hasExactKeys(productionInput.outputSpecification, [
      'mediaType',
      'format',
    ]) ||
    productionInput.outputSpecification.mediaType !== 'video' ||
    productionInput.outputSpecification.format !== 'video/mp4'
  ) {
    return false
  }

  return (
    Array.isArray(candidate.expectedPipeline) &&
    Object.isFrozen(candidate.expectedPipeline) &&
    candidate.expectedPipeline.length === 3 &&
    candidate.expectedPipeline.every(
      (stage, index) =>
        stage === ['Production', 'Artifact', 'Runtime'][index],
    )
  )
}

function expectSuccess(result, label) {
  assert.equal(result.ok, true, `${label}: expected success`)
  return result
}

function assertNoFields(value, fields, label) {
  for (const field of fields) {
    assert.equal(field in value, false, `${label}: ${field} leaked`)
  }
}

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

try {
  const [
    production,
    artifacts,
    runtime,
    { renderRuntimeArtifactInput },
  ] = await Promise.all([
    server.ssrLoadModule('/src/production/index.ts'),
    server.ssrLoadModule('/src/artifacts/index.ts'),
    server.ssrLoadModule('/src/runtime/index.ts'),
    server.ssrLoadModule('/src/utils/sceneRenderer.tsx'),
  ])

  assert.equal(
    validateScenarioValidationCase(scenario),
    true,
    'ScenarioValidationCase must be valid',
  )
  assert.equal(
    new Set([scenario].map((candidate) => candidate.scenarioId)).size,
    1,
    'scenarioId must be unique',
  )
  assert.equal(
    validateScenarioValidationCase({ ...scenario, scenarioId: '' }),
    false,
    'scenarioId must be present',
  )
  assert.equal(
    validateScenarioValidationCase({ ...scenario, scenarioIntent: '' }),
    false,
    'scenarioIntent must be present',
  )
  assert.equal(
    validateScenarioValidationCase({
      ...scenario,
      productionInput: {
        ...scenario.productionInput,
        jobId: '',
      },
    }),
    false,
    'productionInput must be valid',
  )
  assert.equal(
    validateScenarioValidationCase({
      ...scenario,
      expectedPipeline: Object.freeze([
        'Production',
        'Runtime',
        'Artifact',
      ]),
    }),
    false,
    'expectedPipeline must preserve the Production -> Artifact -> Runtime order',
  )
  assert.equal(Object.isFrozen(scenario), true)
  assert.equal(Object.isFrozen(scenario.productionInput), true)
  assertNoFields(
    scenario,
    [
      'artifact',
      'artifactEnvelope',
      'artifactRuntimeReference',
      'ready',
      'validationEvidence',
      'providerState',
      'productionLifecycle',
      'runtimeContext',
      'runtimeState',
    ],
    'ScenarioValidationCase',
  )

  const input = scenario.productionInput
  const jobCreation = expectSuccess(
    production.createProductionJob({
      jobId: input.jobId,
      commandId: input.commandId,
      createdAt: timestamps.created,
    }),
    'ProductionJob creation',
  )
  const scheduledJob = expectSuccess(
    production.transitionProductionJob(
      jobCreation.job,
      'SCHEDULED',
      timestamps.scheduled,
    ),
    'ProductionJob scheduling',
  )
  const runningJob = expectSuccess(
    production.transitionProductionJob(
      scheduledJob.job,
      'RUNNING',
      timestamps.jobRunning,
    ),
    'ProductionJob start',
  )

  const attemptCreation = expectSuccess(
    production.createProductionAttempt({
      attemptId: input.attemptId,
      jobId: input.jobId,
      provider: input.provider,
      createdAt: timestamps.created,
    }),
    'ProductionAttempt creation',
  )
  assert.equal(attemptCreation.attempt.jobId, runningJob.job.jobId)
  const runningAttempt = expectSuccess(
    production.transitionProductionAttempt(
      attemptCreation.attempt,
      'RUNNING',
      timestamps.attemptRunning,
      {
        providerRequestId: input.providerRequestId,
        generationId: input.generationId,
      },
    ),
    'ProductionAttempt start',
  )

  let receivedProviderRequest
  const providerResult = await production.createProviderExecution(
    {
      requestId: input.providerRequestId,
      generationIntent: scenario.scenarioIntent,
      outputSpecification: input.outputSpecification,
    },
    Object.freeze({
      async generate(request) {
        receivedProviderRequest = request
        return {
          referenceId: 'video-reference-scenario-001',
          sourceType: 'provider-output',
          location:
            'https://provider.example/video/production-runtime-scenario.mp4',
          metadata: {
            provider: input.provider,
            model: 'scenario-video-model',
            generationId: input.generationId,
          },
        }
      },
    }),
  )
  expectSuccess(providerResult, 'Provider execution')
  assert.deepEqual(Object.keys(receivedProviderRequest), [
    'requestId',
    'generationIntent',
    'outputSpecification',
  ])
  assert.equal(
    production.validateProviderExecution(providerResult).valid,
    true,
  )
  assert.equal(
    production.validateVideoReference(providerResult.reference).valid,
    true,
  )

  const completedAttempt = expectSuccess(
    production.transitionProductionAttempt(
      runningAttempt.attempt,
      'COMPLETED',
      timestamps.attemptCompleted,
    ),
    'ProductionAttempt completion',
  )
  assert.equal(
    completedAttempt.attempt.generationId,
    providerResult.reference.metadata.generationId,
  )
  const completedJob = expectSuccess(
    production.transitionProductionJob(
      runningJob.job,
      'COMPLETED',
      timestamps.jobCompleted,
    ),
    'ProductionJob completion',
  )
  assert.equal(completedJob.job.status, 'COMPLETED')

  const readyArtifact = Object.freeze({
    artifactId,
    artifactType: 'video',
    status: 'READY',
    source: Object.freeze({
      provider: input.provider,
      model: 'scenario-video-model',
      generationId: input.generationId,
      reference: providerResult.reference.location,
    }),
    location: Object.freeze({
      type: 'local-file',
      path: artifactPath,
    }),
    metadata: Object.freeze({
      mimeType: 'video/mp4',
      size: 4096,
      duration: 5,
      width: 1920,
      height: 1080,
    }),
    validation: Object.freeze({
      status: 'verified',
      checks: Object.freeze([
        Object.freeze({
          name: 'PRODUCTION_RUNTIME_SCENARIO',
          passed: true,
        }),
      ]),
    }),
  })

  let ingestedReference
  let publishedArtifact
  let publicationCount = 0
  const canonicalPublication =
    artifacts.createArtifactRuntimePublicationAdapter()
  const artifactActivation = artifacts.createArtifactActivationService({
    async videoArtifactConsumer(reference) {
      ingestedReference = reference
      return Object.freeze({
        success: true,
        artifact: readyArtifact,
      })
    },
    runtimePublicationPort: Object.freeze({
      publish(artifact) {
        publicationCount += 1
        publishedArtifact = artifact
        return canonicalPublication.publish(artifact)
      },
    }),
  })
  const productionActivation =
    production.createProductionActivationService(artifactActivation)
  const activationResult = await productionActivation.activate({
    activationId: input.activationId,
    attempt: completedAttempt.attempt,
    videoReference: providerResult.reference,
  })
  expectSuccess(activationResult, 'Production Artifact activation')

  assert.deepEqual(ingestedReference, {
    referenceType: 'provider-video',
    reference: providerResult.reference.location,
  })
  assert.equal(publishedArtifact, readyArtifact)
  assert.equal(publicationCount, 1, 'Runtime Reference source must be unique')
  assert.deepEqual(Object.keys(activationResult), [
    'ok',
    'artifactRuntimeReference',
  ])
  assert.equal(
    artifacts.isArtifactRuntimeReference(
      activationResult.artifactRuntimeReference,
    ),
    true,
  )
  assertNoFields(
    activationResult.artifactRuntimeReference,
    [
      'status',
      'READY',
      'validation',
      'source',
      'provider',
      'generationId',
      'productionJobId',
      'productionAttemptId',
    ],
    'ArtifactRuntimeReference',
  )

  const application = runtime.createRuntimeApplicationV2()
  expectSuccess(application, 'Runtime application initialization')
  assert.equal(
    application.context.artifact,
    application.context.services.artifact,
  )
  const consumptionResult =
    await application.context.artifact.consume(
      activationResult.artifactRuntimeReference,
    )
  expectSuccess(consumptionResult, 'Runtime Artifact consumption')
  assert.deepEqual(consumptionResult.input, {
    artifactId,
    artifactType: 'video',
    resource: {
      type: 'runtime-video-source',
      source: artifactPath,
    },
    metadata: {
      mimeType: 'video/mp4',
      size: 4096,
      duration: 5,
      width: 1920,
      height: 1080,
    },
  })
  assert.equal(Object.isFrozen(consumptionResult.input), true)
  assertNoFields(
    consumptionResult.input,
    [
      'status',
      'READY',
      'validation',
      'location',
      'source',
      'provider',
      'generationId',
      'productionJobId',
      'productionAttemptId',
    ],
    'RuntimeArtifactInput',
  )

  const rendered = renderToStaticMarkup(
    renderRuntimeArtifactInput(consumptionResult.input),
  )
  assert.match(rendered, /^<video /)
  assert.match(
    rendered,
    /src="output\/artifacts\/videos\/artifact-scenario-001\.mp4"/,
  )
  assert.match(rendered, /width="1920"/)
  assert.match(rendered, /height="1080"/)

  const [
    runtimeDataTypes,
    runtimeContextTypes,
    rendererSource,
    productionActivationSource,
    activationRequestSource,
  ] = await Promise.all([
    readSource('../src/runtimeData/types.ts'),
    readSource('../src/runtime/context/types.ts'),
    readSource('../src/utils/sceneRenderer.tsx'),
    readSource(
      '../src/production/activation/productionActivationService.ts',
    ),
    readSource('../src/production/activation/createActivationRequest.ts'),
  ])
  const runtimeDataV2Contract = runtimeDataTypes.match(
    /export interface RuntimeDataV2 extends RuntimeDataV1 \{([\s\S]*?)\n\}/,
  )
  assert.ok(runtimeDataV2Contract, 'RuntimeDataV2 contract not found')
  assert.deepEqual(
    [...runtimeDataV2Contract[1].matchAll(/readonly\s+(\w+):/g)].map(
      ([, field]) => field,
    ),
    ['effect', 'depth', 'composition', 'audio'],
    'RuntimeDataV2 contract changed',
  )
  assert.match(
    runtimeContextTypes,
    /readonly artifact: RuntimeArtifactService/,
  )
  assert.equal(
    `${productionActivationSource}\n${activationRequestSource}`.includes(
      'createArtifactRuntimeReference',
    ),
    false,
    'Production created a Runtime Reference',
  )
  assert.equal(
    `${productionActivationSource}\n${activationRequestSource}`.includes(
      'ArtifactEnvelope',
    ),
    false,
    'Production created or owned an ArtifactEnvelope',
  )
  for (const forbidden of [
    'ArtifactRuntimeReference',
    'RuntimeArtifactConsumer',
    'RuntimeArtifactConsumptionAdapter',
    'RuntimeArtifactResolver',
    '../artifacts',
    'READY',
    'Provider',
    'Production',
  ]) {
    assert.equal(
      rendererSource.includes(forbidden),
      false,
      `Renderer boundary leakage: ${forbidden}`,
    )
  }

  console.log('Scenario Validation:')
  console.log('PASS')
  console.log('Production Scenario Execution:')
  console.log('PASS')
  console.log('Artifact Scenario Activation:')
  console.log('PASS')
  console.log('Runtime Scenario Playback:')
  console.log('PASS')
  console.log('Artifact leakage:')
  console.log('ABSENT')
  console.log('READY leakage:')
  console.log('ABSENT')
  console.log('Runtime leakage:')
  console.log('ABSENT')
  console.log('Production leakage:')
  console.log('ABSENT')
  console.log('Production Runtime Scenario:')
  console.log('PASS')
} finally {
  await server.close()
}
