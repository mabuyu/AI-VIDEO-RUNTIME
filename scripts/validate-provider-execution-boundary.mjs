import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal('reference' in result, false, `${label}: partial reference leaked`)
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
}

try {
  const {
    createProviderExecution,
    validateProviderExecution,
    validateVideoReference,
  } = await server.ssrLoadModule('/src/production/index.ts')

  let mappedRequest
  const success = await createProviderExecution(
    {
      requestId: 'request-001',
      generationIntent: 'Generate a quiet cinematic city scene',
      outputSpecification: {
        mediaType: 'video',
        format: 'video/mp4',
      },
      artifactEnvelope: { status: 'READY' },
      runtimeDataV2: { forbidden: true },
    },
    {
      async generate(request) {
        mappedRequest = request
        return {
          referenceId: 'reference-001',
          sourceType: 'provider-output',
          location: 'https://provider.example/video/reference-001.mp4',
          metadata: { model: 'mock-video-model' },
        }
      },
    },
  )

  assert.equal(success.ok, true, 'Provider success mapping failed')
  assert.deepEqual(Object.keys(mappedRequest), [
    'requestId',
    'generationIntent',
    'outputSpecification',
  ])
  assert.equal(Object.isFrozen(mappedRequest), true)
  assert.equal(Object.isFrozen(mappedRequest.outputSpecification), true)
  assert.equal('artifactEnvelope' in mappedRequest, false)
  assert.equal('runtimeDataV2' in mappedRequest, false)
  assert.equal(Object.isFrozen(success.reference), true)
  assert.equal(Object.isFrozen(success.reference.metadata), true)
  assert.deepEqual(Object.keys(success.reference), [
    'referenceId',
    'sourceType',
    'location',
    'metadata',
  ])

  const providerFailure = await createProviderExecution(
    {
      requestId: 'request-002',
      generationIntent: 'Generate a video',
      outputSpecification: {
        mediaType: 'video',
        format: 'video/mp4',
      },
    },
    {
      async generate() {
        throw new Error('private provider failure')
      },
    },
  )
  assertFailure(
    providerFailure,
    'PROVIDER_EXECUTION_FAILED',
    'Provider failure',
  )

  const partialReference = await createProviderExecution(
    {
      requestId: 'request-003',
      generationIntent: 'Generate a video',
      outputSpecification: {
        mediaType: 'video',
        format: 'video/mp4',
      },
    },
    {
      async generate() {
        return {
          referenceId: 'reference-partial',
          sourceType: 'provider-output',
        }
      },
    },
  )
  assertFailure(
    partialReference,
    'PARTIAL_VIDEO_REFERENCE',
    'Partial reference',
  )

  const invalidRequest = await createProviderExecution(null, {
    async generate() {
      throw new Error('must not be called')
    },
  })
  assertFailure(invalidRequest, 'INVALID_REQUEST', 'Invalid request')

  const artifactLeakage = validateVideoReference({
    referenceId: 'reference-artifact',
    sourceType: 'provider-output',
    location: 'https://provider.example/video.mp4',
    metadata: {
      artifactStatus: 'READY',
    },
  })
  assert.equal(artifactLeakage.valid, false)
  assert.equal(artifactLeakage.issues[0]?.code, 'FORBIDDEN_FIELD')

  const runtimeLeakage = validateVideoReference({
    referenceId: 'reference-runtime',
    sourceType: 'provider-output',
    location: 'https://provider.example/video.mp4',
    metadata: {
      runtimeContext: { active: true },
    },
  })
  assert.equal(runtimeLeakage.valid, false)
  assert.equal(runtimeLeakage.issues[0]?.code, 'FORBIDDEN_FIELD')

  const invalidFailure = validateProviderExecution({
    ok: false,
    issues: [{ code: 'FAILED', message: 'failed' }],
    reference: {
      referenceId: 'partial-reference',
    },
  })
  assert.equal(invalidFailure.valid, false)

  console.log('Provider Execution Boundary verification passed')
  console.log('generationRequestCreation = PASS')
  console.log('providerSuccessMapping = PASS')
  console.log('providerFailure = PASS')
  console.log('partialReferenceRejection = PASS')
  console.log('artifactFieldLeakage = ABSENT')
  console.log('runtimeFieldLeakage = ABSENT')
} finally {
  await server.close()
}
