import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.equal('candidateId' in result, false, `${label}: candidate leaked`)
  assert.equal('artifact' in result, false, `${label}: Artifact leaked`)
  assert.equal(
    'artifactEnvelope' in result,
    false,
    `${label}: ArtifactEnvelope leaked`,
  )
  assert.equal(
    'artifactRuntimeReference' in result,
    false,
    `${label}: Runtime reference leaked`,
  )
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
}

const handoffRequest = {
  handoffId: 'ingestion-001',
  productionJobId: 'job-001',
  productionAttemptId: 'attempt-001',
  videoReference: {
    referenceId: 'reference-001',
    sourceType: 'provider-output',
    location: 'https://provider.example/video/reference-001.mp4',
    metadata: {
      provider: 'mock-provider',
      model: 'mock-video-model',
      generationId: 'generation-001',
    },
  },
}

try {
  const {
    createArtifactIngestionAdapter,
  } = await server.ssrLoadModule('/src/production/index.ts')
  const {
    createVideoArtifactIngestionPort,
    validateArtifactIngestionRequest,
    validateArtifactIngestionResult,
  } = await server.ssrLoadModule('/src/artifacts/ingestion/index.ts')

  let receivedRequest
  const adapter = createArtifactIngestionAdapter({
    async ingest(request) {
      receivedRequest = request
      return {
        ok: true,
        candidateId: 'candidate-001',
      }
    },
  })
  const accepted = await adapter.ingest(handoffRequest)

  assert.deepEqual(accepted, {
    ok: true,
    candidateId: 'candidate-001',
  })
  assert.deepEqual(Object.keys(receivedRequest), [
    'ingestionId',
    'sourceReference',
    'productionContext',
  ])
  assert.deepEqual(receivedRequest.productionContext, {
    productionJobId: 'job-001',
    productionAttemptId: 'attempt-001',
  })
  assert.equal(Object.isFrozen(receivedRequest), true)
  assert.equal(Object.isFrozen(receivedRequest.productionContext), true)
  assert.equal('runtimeDataV2' in receivedRequest, false)
  assert.equal('runtimeContext' in receivedRequest, false)
  assert.equal('READY' in receivedRequest, false)
  assert.equal('artifactEnvelope' in receivedRequest, false)
  assert.equal('validation' in receivedRequest, false)

  let invalidPortCalled = false
  const invalidReference = await createArtifactIngestionAdapter({
    async ingest() {
      invalidPortCalled = true
      return { ok: true, candidateId: 'must-not-exist' }
    },
  }).ingest({
    ...handoffRequest,
    videoReference: {
      referenceId: 'reference-invalid',
      sourceType: 'provider-output',
    },
  })
  assertFailure(
    invalidReference,
    'INVALID_VIDEO_REFERENCE',
    'Invalid sourceReference',
  )
  assert.equal(invalidPortCalled, false)

  const runtimeLeakage = validateArtifactIngestionRequest({
    ...receivedRequest,
    productionContext: {
      ...receivedRequest.productionContext,
      runtimeContext: { active: true },
    },
  })
  assert.equal(runtimeLeakage.valid, false)
  assert.equal(runtimeLeakage.issues[0]?.code, 'FORBIDDEN_FIELD')

  const readyLeakage = validateArtifactIngestionRequest({
    ...receivedRequest,
    READY: true,
  })
  assert.equal(readyLeakage.valid, false)
  assert.equal(readyLeakage.issues[0]?.code, 'FORBIDDEN_FIELD')

  const ownershipLeakage = validateArtifactIngestionResult({
    ok: true,
    candidateId: 'candidate-001',
    artifactEnvelope: { status: 'READY' },
  })
  assert.equal(ownershipLeakage.valid, false)
  assert.equal(ownershipLeakage.issues[0]?.code, 'FORBIDDEN_FIELD')

  const rejected = await createArtifactIngestionAdapter({
    async ingest() {
      return {
        ok: false,
        issues: [
          {
            code: 'ARTIFACT_CONSUMER_FAILED',
            message: 'Artifact Consumer rejected the candidate',
          },
        ],
      }
    },
  }).ingest(handoffRequest)
  assertFailure(
    rejected,
    'ARTIFACT_CONSUMER_FAILED',
    'Artifact consumer failure',
  )

  const thrown = await createArtifactIngestionAdapter({
    async ingest() {
      throw new Error('private Artifact Consumer failure')
    },
  }).ingest(handoffRequest)
  assertFailure(
    thrown,
    'ARTIFACT_CONSUMER_FAILED',
    'Thrown Artifact consumer failure',
  )

  let consumerReference
  let consumerSource
  const artifactPort = createVideoArtifactIngestionPort(
    async (reference, source) => {
      consumerReference = reference
      consumerSource = source
      return {
        success: true,
        artifact: {
          artifactId: 'artifact-001',
          artifactType: 'video',
          status: 'READY',
          source: {
            ...source,
            reference: reference.reference,
          },
          location: {
            type: 'local-file',
            path: 'output/artifacts/videos/artifact-001.mp4',
          },
          metadata: {
            mimeType: 'video/mp4',
            size: 8,
          },
          validation: {
            status: 'verified',
            checks: [
              {
                name: 'FILE_SIGNATURE',
                passed: true,
              },
            ],
          },
        },
      }
    },
  )
  const integrated = await createArtifactIngestionAdapter(artifactPort).ingest(
    handoffRequest,
  )
  assert.deepEqual(integrated, {
    ok: true,
    candidateId: 'ingestion-001',
  })
  assert.deepEqual(consumerReference, {
    referenceType: 'provider-video',
    reference: handoffRequest.videoReference.location,
  })
  assert.deepEqual(consumerSource, {
    provider: 'mock-provider',
    model: 'mock-video-model',
    generationId: 'generation-001',
  })
  assert.equal('artifact' in integrated, false)
  assert.equal('artifactEnvelope' in integrated, false)
  assert.equal('READY' in integrated, false)

  console.log('Artifact Ingestion Integration verification passed')
  console.log('validVideoReferenceIngestion = PASS')
  console.log('invalidSourceReference = PASS')
  console.log('runtimeFieldLeakage = ABSENT')
  console.log('readyLeakage = ABSENT')
  console.log('artifactOwnershipLeakage = ABSENT')
  console.log('artifactConsumerFailure = PASS')
  console.log('artifactLayerReuse = PASS')
} finally {
  await server.close()
}
