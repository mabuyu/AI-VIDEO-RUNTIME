import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const ids = Object.freeze({
  command: 'command-alpha-001',
  job: 'job-alpha-001',
  attempt: 'attempt-alpha-001',
  providerRequest: 'provider-request-alpha-001',
  generation: 'generation-alpha-001',
  reference: 'video-reference-alpha-001',
  activation: 'activation-alpha-001',
  artifact: 'artifact-alpha-001',
})

const timestamps = Object.freeze({
  created: '2026-07-26T08:00:00.000Z',
  scheduled: '2026-07-26T08:00:01.000Z',
  jobRunning: '2026-07-26T08:00:02.000Z',
  attemptRunning: '2026-07-26T08:00:03.000Z',
  attemptCompleted: '2026-07-26T08:00:04.000Z',
  jobCompleted: '2026-07-26T08:00:05.000Z',
})

const artifactPath =
  'output/artifacts/videos/artifact-alpha-001.mp4'

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

  const jobCreation = expectSuccess(
    production.createProductionJob({
      jobId: ids.job,
      commandId: ids.command,
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
      attemptId: ids.attempt,
      jobId: ids.job,
      provider: 'alpha-provider',
      createdAt: timestamps.created,
    }),
    'ProductionAttempt creation',
  )
  assert.equal(
    attemptCreation.attempt.jobId,
    runningJob.job.jobId,
    'ProductionAttempt must belong to the active ProductionJob',
  )

  const runningAttempt = expectSuccess(
    production.transitionProductionAttempt(
      attemptCreation.attempt,
      'RUNNING',
      timestamps.attemptRunning,
      {
        providerRequestId: ids.providerRequest,
        generationId: ids.generation,
      },
    ),
    'ProductionAttempt start',
  )

  let receivedProviderRequest
  const providerResult = await production.createProviderExecution(
    {
      requestId: ids.providerRequest,
      generationIntent:
        'Production Runtime Alpha validation video',
      outputSpecification: {
        mediaType: 'video',
        format: 'video/mp4',
      },
    },
    Object.freeze({
      async generate(request) {
        receivedProviderRequest = request
        return {
          referenceId: ids.reference,
          sourceType: 'provider-output',
          location:
            'https://provider.example/video/production-runtime-alpha.mp4',
          metadata: {
            provider: 'alpha-provider',
            model: 'alpha-video-model',
            generationId: ids.generation,
          },
        }
      },
    }),
  )
  expectSuccess(providerResult, 'Provider execution')
  assert.equal(receivedProviderRequest.requestId, ids.providerRequest)
  assert.equal(
    production.validateProviderExecution(providerResult).valid,
    true,
    'Provider result contract must be valid',
  )
  assert.equal(
    production.validateVideoReference(providerResult.reference).valid,
    true,
    'VideoReference contract must be valid',
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
    'ProductionAttempt and VideoReference must retain generation correlation',
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

  let ingestedReference
  let ingestedSource
  const readyArtifact = Object.freeze({
    artifactId: ids.artifact,
    artifactType: 'video',
    status: 'READY',
    source: Object.freeze({
      provider: 'alpha-provider',
      model: 'alpha-video-model',
      generationId: ids.generation,
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
          name: 'PRODUCTION_RUNTIME_ALPHA',
          passed: true,
        }),
      ]),
    }),
  })

  const artifactActivation = artifacts.createArtifactActivationService({
    async videoArtifactConsumer(reference, source) {
      ingestedReference = reference
      ingestedSource = source
      return Object.freeze({
        success: true,
        artifact: readyArtifact,
      })
    },
  })
  const productionActivation =
    production.createProductionActivationService(artifactActivation)
  const activationResult = await productionActivation.activate({
    activationId: ids.activation,
    attempt: completedAttempt.attempt,
    videoReference: providerResult.reference,
  })
  expectSuccess(activationResult, 'Production Artifact activation')

  assert.deepEqual(ingestedReference, {
    referenceType: 'provider-video',
    reference: providerResult.reference.location,
  })
  assert.deepEqual(ingestedSource, {
    provider: 'alpha-provider',
    model: 'alpha-video-model',
    generationId: ids.generation,
  })
  assert.deepEqual(
    Object.keys(activationResult),
    ['ok', 'artifactRuntimeReference'],
    'Production may receive only the Artifact-owned Runtime Reference',
  )
  assert.deepEqual(
    activationResult.artifactRuntimeReference,
    {
      artifactId: ids.artifact,
      artifactType: 'video',
      location: {
        type: 'local-file',
        path: artifactPath,
      },
      metadata: {
        mimeType: 'video/mp4',
        size: 4096,
        duration: 5,
        width: 1920,
        height: 1080,
      },
    },
    'Artifact Layer must publish the canonical Runtime Reference',
  )
  assert.equal(
    artifacts.isArtifactRuntimeReference(
      activationResult.artifactRuntimeReference,
    ),
    true,
  )
  assertNoFields(
    activationResult.artifactRuntimeReference,
    ['status', 'READY', 'validation', 'source', 'provider', 'generationId'],
    'ArtifactRuntimeReference',
  )

  const application = runtime.createRuntimeApplicationV2()
  expectSuccess(application, 'Runtime application initialization')
  assert.equal(
    application.context.artifact,
    application.context.services.artifact,
    'RuntimeContext must expose the existing Runtime Artifact Service',
  )

  const consumptionResult =
    await application.context.artifact.consume(
      activationResult.artifactRuntimeReference,
    )
  expectSuccess(consumptionResult, 'Runtime Artifact consumption')
  assert.deepEqual(consumptionResult.input, {
    artifactId: ids.artifact,
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
  assert.equal(Object.isFrozen(consumptionResult.input.resource), true)
  assert.equal(Object.isFrozen(consumptionResult.input.metadata), true)
  assertNoFields(
    consumptionResult.input,
    ['status', 'READY', 'validation', 'location', 'source'],
    'RuntimeArtifactInput',
  )

  const rendered = renderToStaticMarkup(
    renderRuntimeArtifactInput(consumptionResult.input),
  )
  assert.match(rendered, /^<video /)
  assert.match(
    rendered,
    /src="output\/artifacts\/videos\/artifact-alpha-001\.mp4"/,
  )
  assert.match(rendered, /width="1920"/)
  assert.match(rendered, /height="1080"/)

  const [runtimeDataTypes, runtimeContextTypes, rendererSource] =
    await Promise.all([
      readSource('../src/runtimeData/types.ts'),
      readSource('../src/runtime/context/types.ts'),
      readSource('../src/utils/sceneRenderer.tsx'),
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

  console.log('Production Pipeline: PASS')
  console.log('Artifact Pipeline: PASS')
  console.log('Runtime Consumption: PASS')
  console.log('Renderer Boundary: PASS')
  console.log('Production Runtime Alpha: PASS')
} finally {
  await server.close()
}
