import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal('input' in result, false, `${label}: partial input leaked`)
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
  assert.equal(Object.isFrozen(result.issues[0]), true, `${label}: issue is mutable`)
}

try {
  const { createRuntimeArtifactConsumer } =
    await server.ssrLoadModule('/src/runtime/services/artifact/index.ts')

  const reference = {
    artifactId: 'artifact-video-001',
    artifactType: 'video',
    location: {
      type: 'local-file',
      path: 'output/artifacts/videos/artifact-video-001.mp4',
      storageHandle: 'must-not-leak',
    },
    metadata: {
      mimeType: 'video/mp4',
      size: 4096,
      duration: 3000,
      width: 1080,
      height: 1920,
      validation: 'must-not-leak',
    },
    status: 'READY',
    provider: 'must-not-leak',
    lifecycle: 'must-not-leak',
  }
  const referenceBefore = structuredClone(reference)
  const consumer = createRuntimeArtifactConsumer()
  const success = await consumer.consume(reference)

  assert.equal(success.ok, true, 'valid reference must succeed')
  assert.deepEqual(success.input, {
    artifactId: 'artifact-video-001',
    artifactType: 'video',
    resource: {
      type: 'runtime-video-source',
      source: 'output/artifacts/videos/artifact-video-001.mp4',
    },
    metadata: {
      mimeType: 'video/mp4',
      size: 4096,
      duration: 3000,
      width: 1080,
      height: 1920,
    },
  })
  assert.deepEqual(reference, referenceBefore, 'consumer mutated source reference')
  assert.deepEqual(
    Object.keys(success.input),
    ['artifactId', 'artifactType', 'resource', 'metadata'],
    'RuntimeArtifactInput field leakage',
  )
  assert.deepEqual(Object.keys(success.input.resource), ['type', 'source'])
  assert.deepEqual(
    Object.keys(success.input.metadata),
    ['mimeType', 'size', 'duration', 'width', 'height'],
  )
  assert.equal(JSON.stringify(success.input).includes('must-not-leak'), false)
  assert.equal(Object.isFrozen(consumer), true)
  assert.equal(Object.isFrozen(success), true)
  assert.equal(Object.isFrozen(success.input), true)
  assert.equal(Object.isFrozen(success.input.resource), true)
  assert.equal(Object.isFrozen(success.input.metadata), true)
  assert.throws(() => {
    success.input.resource.source = 'mutated.mp4'
  }, TypeError)

  assertFailure(
    await consumer.consume({ ...reference, artifactType: 'audio' }),
    'UNSUPPORTED_ARTIFACT_TYPE',
    'unsupported artifact type',
  )
  assertFailure(
    await consumer.consume({
      ...reference,
      location: { type: 'remote-url', path: reference.location.path },
    }),
    'UNSUPPORTED_LOCATION_TYPE',
    'unsupported location type',
  )
  assertFailure(
    await consumer.consume({
      ...reference,
      location: { type: 'local-file', path: '   ' },
    }),
    'RESOLUTION_FAILED',
    'empty local source',
  )
  assertFailure(
    await consumer.consume({
      ...reference,
      metadata: { ...reference.metadata, size: 0 },
    }),
    'CONSUMPTION_FAILED',
    'incomplete consumption metadata',
  )

  const malformedResolverConsumer = createRuntimeArtifactConsumer({
    async resolve() {
      return {
        ok: true,
        resource: { type: 'runtime-video-source', source: '' },
      }
    },
  })
  assertFailure(
    await malformedResolverConsumer.consume(reference),
    'CONSUMPTION_FAILED',
    'malformed resolver resource',
  )

  const throwingResolverConsumer = createRuntimeArtifactConsumer({
    async resolve() {
      throw new Error('resolver failure')
    },
  })
  assertFailure(
    await throwingResolverConsumer.consume(reference),
    'RESOLUTION_FAILED',
    'throwing resolver',
  )

  console.log('Runtime Artifact Consumption MVP verification passed')
  console.log('validReferenceSuccess = PASS')
  console.log('invalidReferenceReject = PASS')
  console.log('fieldLeakage = ABSENT')
  console.log('immutableOutput = PASS')
  console.log('partialInput = ABSENT')
} finally {
  await server.close()
}
