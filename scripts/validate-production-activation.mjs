import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const completedAttempt = Object.freeze({
  attemptId: 'attempt-activation-001',
  jobId: 'job-activation-001',
  provider: 'mock-provider',
  generationId: 'generation-activation-001',
  status: 'COMPLETED',
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:02:00.000Z',
})

const videoReference = Object.freeze({
  referenceId: 'reference-activation-001',
  sourceType: 'provider-output',
  location: 'https://provider.example/video/activation-001.mp4',
  metadata: Object.freeze({
    provider: 'mock-provider',
    model: 'mock-model',
  }),
})

function createInput(overrides = {}) {
  return {
    activationId: 'activation-001',
    attempt: completedAttempt,
    videoReference,
    ...overrides,
  }
}

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.equal('request' in result, false, `${label}: partial request leaked`)
  assert.equal('artifact' in result, false, `${label}: partial Artifact leaked`)
  assert.equal(
    'artifactEnvelope' in result,
    false,
    `${label}: ArtifactEnvelope leaked`,
  )
  assert.equal('READY' in result, false, `${label}: READY leaked`)
  assert.equal(
    'artifactRuntimeReference' in result,
    false,
    `${label}: ArtifactRuntimeReference leaked`,
  )
  assert.equal('runtimeDataV2' in result, false, `${label}: RuntimeDataV2 leaked`)
  assert.equal('runtimeContext' in result, false, `${label}: RuntimeContext leaked`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
  assert.equal(
    Object.isFrozen(result.issues[0]),
    true,
    `${label}: issue is mutable`,
  )
}

try {
  const {
    createActivationRequest,
    createProductionActivationService,
    ProductionActivationService,
  } = await server.ssrLoadModule('/src/production/index.ts')

  const creation = createActivationRequest(createInput())
  assert.equal(creation.ok, true, 'Activation request creation failed')
  assert.deepEqual(Object.keys(creation.request), [
    'activationId',
    'productionJobId',
    'productionAttemptId',
    'videoReference',
  ])
  assert.deepEqual(creation.request, {
    activationId: 'activation-001',
    productionJobId: 'job-activation-001',
    productionAttemptId: 'attempt-activation-001',
    videoReference,
  })
  assert.notEqual(
    creation.request.videoReference,
    videoReference,
    'Activation request must own a defensive VideoReference copy',
  )
  assert.equal(Object.isFrozen(creation), true)
  assert.equal(Object.isFrozen(creation.request), true)
  assert.equal(Object.isFrozen(creation.request.videoReference), true)
  assert.equal(Object.isFrozen(creation.request.videoReference.metadata), true)
  assert.equal('artifactEnvelope' in creation.request, false)
  assert.equal('READY' in creation.request, false)
  assert.equal('validation' in creation.request, false)
  assert.equal('artifactRuntimeReference' in creation.request, false)
  assert.equal('runtimeDataV2' in creation.request, false)
  assert.equal('runtimeContext' in creation.request, false)
  assert.equal('renderer' in creation.request, false)

  let receivedRequest
  const service = createProductionActivationService({
    async activate(request) {
      receivedRequest = request
      return {
        ok: true,
        activationId: request.activationId,
      }
    },
  })
  assert.equal(service instanceof ProductionActivationService, true)
  assert.equal(Object.isFrozen(service), true)

  const accepted = await service.activate(createInput())
  assert.deepEqual(receivedRequest, creation.request)
  assert.notEqual(
    receivedRequest,
    creation.request,
    'Service must create a fresh canonical request per activation',
  )
  assert.equal(Object.isFrozen(receivedRequest), true)
  assert.deepEqual(accepted, {
    ok: true,
    activationId: 'activation-001',
  })
  assert.deepEqual(Object.keys(accepted), ['ok', 'activationId'])
  assert.equal(Object.isFrozen(accepted), true)

  for (const status of ['CREATED', 'RUNNING', 'FAILED']) {
    let invalidPortCalled = false
    const invalidService = createProductionActivationService({
      async activate() {
        invalidPortCalled = true
        return { ok: true, activationId: 'must-not-exist' }
      },
    })
    const result = await invalidService.activate(
      createInput({
        attempt: {
          ...completedAttempt,
          status,
        },
      }),
    )
    assertFailure(
      result,
      'ATTEMPT_NOT_COMPLETED',
      `${status} attempt rejection`,
    )
    assert.equal(invalidPortCalled, false, `${status}: Port was called`)
  }

  let invalidReferencePortCalled = false
  const invalidReference = await createProductionActivationService({
    async activate() {
      invalidReferencePortCalled = true
      return { ok: true, activationId: 'must-not-exist' }
    },
  }).activate(
    createInput({
      videoReference: {
        referenceId: 'invalid-reference',
        sourceType: 'provider-output',
      },
    }),
  )
  assertFailure(
    invalidReference,
    'INVALID_VIDEO_REFERENCE',
    'Invalid VideoReference rejection',
  )
  assert.equal(invalidReferencePortCalled, false)

  const invalidInput = createActivationRequest({
    ...createInput(),
    artifactEnvelope: {
      status: 'READY',
    },
  })
  assertFailure(
    invalidInput,
    'INVALID_ACTIVATION_INPUT',
    'Artifact input rejection',
  )

  const rejected = await createProductionActivationService({
    async activate() {
      return {
        ok: false,
        issues: [
          {
            code: 'ARTIFACT_ACTIVATION_REJECTED',
            message: 'Artifact Layer did not accept activation',
          },
        ],
      }
    },
  }).activate(createInput())
  assertFailure(
    rejected,
    'ARTIFACT_ACTIVATION_REJECTED',
    'Artifact Port rejection',
  )

  const partialArtifact = await createProductionActivationService({
    async activate() {
      return {
        ok: false,
        issues: [
          {
            code: 'ARTIFACT_ACTIVATION_REJECTED',
            message: 'Artifact activation failed',
          },
        ],
        artifactEnvelope: {
          status: 'READY',
        },
      }
    },
  }).activate(createInput())
  assertFailure(
    partialArtifact,
    'FORBIDDEN_FIELD',
    'Partial Artifact failure',
  )

  const readyLeakage = await createProductionActivationService({
    async activate() {
      return {
        ok: true,
        activationId: 'activation-001',
        READY: true,
      }
    },
  }).activate(createInput())
  assertFailure(readyLeakage, 'FORBIDDEN_FIELD', 'READY result leakage')

  const runtimeLeakage = await createProductionActivationService({
    async activate() {
      return {
        ok: true,
        activationId: 'activation-001',
        artifactRuntimeReference: {
          artifactId: 'artifact-001',
        },
      }
    },
  }).activate(createInput())
  assertFailure(
    runtimeLeakage,
    'FORBIDDEN_FIELD',
    'Runtime reference leakage',
  )

  const mismatchedIdentity = await createProductionActivationService({
    async activate() {
      return {
        ok: true,
        activationId: 'activation-other',
      }
    },
  }).activate(createInput())
  assertFailure(
    mismatchedIdentity,
    'INVALID_ACTIVATION_RESULT',
    'Mismatched activation identity',
  )

  const duplicateIdentity = await createProductionActivationService({
    async activate() {
      return {
        ok: true,
        activationId: 'activation-other',
        handoffId: 'activation-001',
      }
    },
  }).activate(createInput())
  assertFailure(
    duplicateIdentity,
    'INVALID_ACTIVATION_RESULT',
    'Duplicate activation identity',
  )

  const thrownPort = await createProductionActivationService({
    async activate() {
      throw new Error('private Artifact activation failure')
    },
  }).activate(createInput())
  assertFailure(
    thrownPort,
    'ARTIFACT_ACTIVATION_FAILED',
    'Thrown Artifact Port failure',
  )

  console.log('Production Activation MVP verification passed')
  console.log('activationRequestCreation = PASS')
  console.log('completedAttemptAcceptance = PASS')
  console.log('invalidAttemptRejection = PASS')
  console.log('artifactLeakage = ABSENT')
  console.log('readyLeakage = ABSENT')
  console.log('runtimeLeakage = ABSENT')
  console.log('failureFailClosed = PASS')
} finally {
  await server.close()
}
