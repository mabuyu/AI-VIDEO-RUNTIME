import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal('request' in result, false, `${label}: partial request leaked`)
  assert.equal('artifact' in result, false, `${label}: partial artifact leaked`)
  assert.equal(
    'artifactEnvelope' in result,
    false,
    `${label}: ArtifactEnvelope leaked`,
  )
  assert.equal(
    'artifactRuntimeReference' in result,
    false,
    `${label}: ArtifactRuntimeReference leaked`,
  )
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
}

try {
  const {
    createArtifactHandoffRequest,
    submitArtifactHandoff,
    validateArtifactHandoffResult,
  } = await server.ssrLoadModule('/src/production/index.ts')

  const creation = createArtifactHandoffRequest({
    handoffId: 'handoff-001',
    productionJobId: 'job-001',
    productionAttemptId: 'attempt-001',
    videoReference: {
      referenceId: 'reference-001',
      sourceType: 'provider-output',
      location: 'https://provider.example/video/reference-001.mp4',
      metadata: {
        provider: 'mock-provider',
        model: 'mock-video-model',
      },
    },
  })

  assert.equal(creation.ok, true, 'Valid VideoReference handoff failed')
  assert.deepEqual(Object.keys(creation.request), [
    'handoffId',
    'productionJobId',
    'productionAttemptId',
    'videoReference',
  ])
  assert.equal(Object.isFrozen(creation), true)
  assert.equal(Object.isFrozen(creation.request), true)
  assert.equal(Object.isFrozen(creation.request.videoReference), true)
  assert.equal(Object.isFrozen(creation.request.videoReference.metadata), true)
  assert.equal('artifactEnvelope' in creation.request, false)
  assert.equal('artifactRuntimeReference' in creation.request, false)
  assert.equal('runtimeDataV2' in creation.request, false)
  assert.equal('runtimeContext' in creation.request, false)
  assert.equal('ready' in creation.request, false)

  let receivedRequest
  const accepted = await submitArtifactHandoff(creation.request, {
    async handoff(request) {
      receivedRequest = request
      return {
        ok: true,
        handoffId: request.handoffId,
      }
    },
  })

  assert.deepEqual(receivedRequest, creation.request)
  assert.notEqual(
    receivedRequest,
    creation.request,
    'Adapter must submit a canonical boundary-owned request copy',
  )
  assert.equal(Object.isFrozen(receivedRequest), true)
  assert.deepEqual(accepted, {
    ok: true,
    handoffId: 'handoff-001',
  })
  assert.equal(Object.isFrozen(accepted), true)
  assert.deepEqual(Object.keys(accepted), ['ok', 'handoffId'])

  assertFailure(
    createArtifactHandoffRequest({
      handoffId: 'handoff-invalid-reference',
      productionJobId: 'job-001',
      productionAttemptId: 'attempt-001',
      videoReference: {
        referenceId: 'reference-partial',
        sourceType: 'provider-output',
      },
    }),
    'INVALID_VIDEO_REFERENCE',
    'Invalid VideoReference rejection',
  )

  assertFailure(
    createArtifactHandoffRequest({
      handoffId: 'handoff-artifact-leakage',
      productionJobId: 'job-001',
      productionAttemptId: 'attempt-001',
      videoReference: {
        referenceId: 'reference-002',
        sourceType: 'provider-output',
        location: 'https://provider.example/video/reference-002.mp4',
      },
      artifactEnvelope: {
        status: 'READY',
      },
    }),
    'FORBIDDEN_FIELD',
    'Artifact field leakage',
  )

  assertFailure(
    createArtifactHandoffRequest({
      handoffId: 'handoff-runtime-leakage',
      productionJobId: 'job-001',
      productionAttemptId: 'attempt-001',
      videoReference: {
        referenceId: 'reference-003',
        sourceType: 'provider-output',
        location: 'https://provider.example/video/reference-003.mp4',
      },
      runtimeContext: {
        active: true,
      },
    }),
    'FORBIDDEN_FIELD',
    'Runtime field leakage',
  )

  assertFailure(
    createArtifactHandoffRequest({
      handoffId: 'handoff-ready-leakage',
      productionJobId: 'job-001',
      productionAttemptId: 'attempt-001',
      videoReference: {
        referenceId: 'reference-004',
        sourceType: 'provider-output',
        location: 'https://provider.example/video/reference-004.mp4',
      },
      READY: true,
    }),
    'FORBIDDEN_FIELD',
    'READY field rejection',
  )

  const rejected = await submitArtifactHandoff(creation.request, {
    async handoff() {
      return {
        ok: false,
        issues: [
          {
            code: 'INGESTION_REJECTED',
            message: 'Artifact Consumer did not accept ownership',
          },
        ],
      }
    },
  })
  assertFailure(rejected, 'INGESTION_REJECTED', 'Consumer rejection')

  const partialArtifact = await submitArtifactHandoff(creation.request, {
    async handoff(request) {
      return {
        ok: false,
        issues: [
          {
            code: 'INGESTION_REJECTED',
            message: 'Artifact Consumer failed after candidate creation',
          },
        ],
        artifact: {
          artifactId: 'partial-artifact',
          handoffId: request.handoffId,
        },
      }
    },
  })
  assertFailure(
    partialArtifact,
    'FORBIDDEN_FIELD',
    'Partial artifact output',
  )

  const artifactResultLeakage = validateArtifactHandoffResult({
    ok: true,
    handoffId: 'handoff-001',
    artifactEnvelope: {
      status: 'READY',
    },
  })
  assert.equal(artifactResultLeakage.valid, false)
  assert.equal(artifactResultLeakage.issues[0]?.code, 'FORBIDDEN_FIELD')

  const mismatchedIdentity = await submitArtifactHandoff(creation.request, {
    async handoff() {
      return {
        ok: true,
        handoffId: 'handoff-other',
      }
    },
  })
  assertFailure(
    mismatchedIdentity,
    'INVALID_HANDOFF_RESULT',
    'Mismatched handoff identity',
  )

  const thrownConsumer = await submitArtifactHandoff(creation.request, {
    async handoff() {
      throw new Error('private Artifact Consumer failure')
    },
  })
  assertFailure(
    thrownConsumer,
    'ARTIFACT_HANDOFF_FAILED',
    'Thrown Consumer failure',
  )

  console.log('Production Artifact Handoff verification passed')
  console.log('validVideoReferenceHandoff = PASS')
  console.log('invalidVideoReferenceRejection = PASS')
  console.log('artifactFieldLeakage = ABSENT')
  console.log('runtimeFieldLeakage = ABSENT')
  console.log('readyFieldRejection = PASS')
  console.log('partialArtifactOutput = ABSENT')
} finally {
  await server.close()
}
