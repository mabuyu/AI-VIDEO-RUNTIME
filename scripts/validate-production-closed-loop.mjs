import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const completedAttempt = Object.freeze({
  attemptId: 'attempt-closed-loop-001',
  jobId: 'job-closed-loop-001',
  provider: 'mock-provider',
  generationId: 'generation-closed-loop-001',
  status: 'COMPLETED',
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:02:00.000Z',
})

const videoReference = Object.freeze({
  referenceId: 'reference-closed-loop-001',
  sourceType: 'provider-output',
  location: 'https://provider.example/video/closed-loop-001.mp4',
  metadata: Object.freeze({
    provider: 'mock-provider',
    model: 'mock-model',
    generationId: 'generation-closed-loop-001',
  }),
})

const readyArtifact = Object.freeze({
  artifactId: 'artifact-closed-loop-001',
  artifactType: 'video',
  status: 'READY',
  source: Object.freeze({
    provider: 'mock-provider',
    model: 'mock-model',
    generationId: 'generation-closed-loop-001',
    reference: videoReference.location,
  }),
  location: Object.freeze({
    type: 'local-file',
    path: 'output/artifacts/videos/artifact-closed-loop-001.mp4',
  }),
  metadata: Object.freeze({
    mimeType: 'video/mp4',
    size: 1024,
    duration: 5,
    width: 1920,
    height: 1080,
  }),
  validation: Object.freeze({
    status: 'verified',
    checks: Object.freeze([
      Object.freeze({
        name: 'FILE_SIGNATURE',
        passed: true,
      }),
    ]),
  }),
})

function input(overrides = {}) {
  return {
    activationId: 'activation-closed-loop-001',
    attempt: completedAttempt,
    videoReference,
    ...overrides,
  }
}

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'])
  assert.equal('artifact' in result, false, `${label}: partial Artifact leaked`)
  assert.equal(
    'artifactRuntimeReference' in result,
    false,
    `${label}: partial Runtime Reference leaked`,
  )
  assert.equal('READY' in result, false, `${label}: READY leaked`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
}

try {
  const {
    createProductionActivationService,
  } = await server.ssrLoadModule('/src/production/index.ts')
  const {
    createArtifactActivationService,
  } = await server.ssrLoadModule('/src/artifacts/index.ts')

  let receivedReference
  let receivedSource
  const artifactActivation = createArtifactActivationService({
    async videoArtifactConsumer(reference, source) {
      receivedReference = reference
      receivedSource = source
      return {
        success: true,
        artifact: readyArtifact,
      }
    },
  })
  const productionActivation =
    createProductionActivationService(artifactActivation)
  const result = await productionActivation.activate(input())

  assert.equal(result.ok, true, 'Closed loop activation failed')
  assert.deepEqual(Object.keys(result), ['ok', 'artifactRuntimeReference'])
  assert.deepEqual(result.artifactRuntimeReference, {
    artifactId: 'artifact-closed-loop-001',
    artifactType: 'video',
    location: {
      type: 'local-file',
      path: 'output/artifacts/videos/artifact-closed-loop-001.mp4',
    },
    metadata: {
      mimeType: 'video/mp4',
      size: 1024,
      duration: 5,
      width: 1920,
      height: 1080,
    },
  })
  assert.deepEqual(receivedReference, {
    referenceType: 'provider-video',
    reference: videoReference.location,
  })
  assert.deepEqual(receivedSource, {
    provider: 'mock-provider',
    model: 'mock-model',
    generationId: 'generation-closed-loop-001',
  })
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.artifactRuntimeReference), true)
  assert.equal(Object.isFrozen(result.artifactRuntimeReference.location), true)
  assert.equal(Object.isFrozen(result.artifactRuntimeReference.metadata), true)
  for (const forbidden of [
    'status',
    'validation',
    'source',
    'provider',
    'generationId',
    'productionJobId',
    'productionAttemptId',
    'runtimeDataV2',
    'runtimeContext',
    'renderer',
  ]) {
    assert.equal(
      forbidden in result.artifactRuntimeReference,
      false,
      `${forbidden} leaked into Runtime Reference`,
    )
  }

  const ingestionFailure = await createProductionActivationService(
    createArtifactActivationService({
      async videoArtifactConsumer() {
        return {
          success: false,
          issues: [
            {
              code: 'ARTIFACT_VALIDATION_FAILED',
              message: 'Managed Artifact validation failed',
            },
          ],
        }
      },
    }),
  ).activate(input())
  assertFailure(
    ingestionFailure,
    'ARTIFACT_VALIDATION_FAILED',
    'Artifact ingestion failure',
  )

  const publicationFailure = await createProductionActivationService(
    createArtifactActivationService({
      async videoArtifactConsumer() {
        return { success: true, artifact: readyArtifact }
      },
      runtimePublicationPort: {
        publish() {
          return Object.freeze({
            ok: false,
            issues: Object.freeze([
              Object.freeze({
                code: 'RUNTIME_REFERENCE_PUBLICATION_FAILED',
                message: 'Runtime Reference publication failed',
              }),
            ]),
          })
        },
      },
    }),
  ).activate(input())
  assertFailure(
    publicationFailure,
    'RUNTIME_REFERENCE_PUBLICATION_FAILED',
    'Runtime Reference publication failure',
  )

  const notCompleted = await createProductionActivationService(
    artifactActivation,
  ).activate(
    input({
      attempt: {
        ...completedAttempt,
        status: 'RUNNING',
      },
    }),
  )
  assertFailure(
    notCompleted,
    'ATTEMPT_NOT_COMPLETED',
    'Incomplete Production Attempt',
  )

  console.log('Production Closed Loop verification passed')
  console.log('completedProductionAttempt = PASS')
  console.log('activationRequest = PASS')
  console.log('artifactActivation = PASS')
  console.log('readyOwnership = PASS')
  console.log('runtimeReferencePublication = PASS')
  console.log('artifactLeakage = ABSENT')
  console.log('runtimeLeakage = ABSENT')
  console.log('productionLeakage = ABSENT')
  console.log('failureFailClosed = PASS')
} finally {
  await server.close()
}
