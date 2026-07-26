import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const reference = Object.freeze({
  artifactId: 'artifact-adapter-001',
  artifactType: 'video',
  location: Object.freeze({
    type: 'local-file',
    path: 'output/artifacts/videos/artifact-adapter-001.mp4',
  }),
  metadata: Object.freeze({
    mimeType: 'video/mp4',
    size: 4096,
    duration: 5,
    width: 1920,
    height: 1080,
  }),
})

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'])
  assert.equal('input' in result, false, `${label}: partial input leaked`)
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
  assert.equal(
    Object.isFrozen(result.issues[0]),
    true,
    `${label}: issue is mutable`,
  )
}

async function readFiles(paths) {
  return Promise.all(
    paths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
  )
}

try {
  const {
    createRuntimeArtifactConsumptionAdapter,
  } = await server.ssrLoadModule('/src/runtime/services/artifact/index.ts')

  const adapter = createRuntimeArtifactConsumptionAdapter()
  const success = await adapter.consume(reference)

  assert.equal(success.ok, true, 'valid ArtifactRuntimeReference must succeed')
  assert.deepEqual(success.input, {
    artifactId: 'artifact-adapter-001',
    artifactType: 'video',
    resource: {
      type: 'runtime-video-source',
      source: 'output/artifacts/videos/artifact-adapter-001.mp4',
    },
    metadata: {
      mimeType: 'video/mp4',
      size: 4096,
      duration: 5,
      width: 1920,
      height: 1080,
    },
  })
  assert.equal(Object.isFrozen(adapter), true)
  assert.equal(Object.isFrozen(success), true)
  assert.equal(Object.isFrozen(success.input), true)
  assert.equal(Object.isFrozen(success.input.resource), true)
  assert.equal(Object.isFrozen(success.input.metadata), true)

  const mapped = await createRuntimeArtifactConsumptionAdapter({
    async consume(receivedReference) {
      assert.equal(receivedReference, reference)
      return {
        ok: true,
        input: {
          artifactId: receivedReference.artifactId,
          artifactType: 'video',
          resource: {
            type: 'runtime-video-source',
            source: receivedReference.location.path,
          },
          metadata: {
            mimeType: 'video/mp4',
            size: receivedReference.metadata.size,
          },
        },
      }
    },
  }).consume(reference)
  assert.equal(mapped.ok, true, 'Consumer success mapping must succeed')
  assert.equal(Object.isFrozen(mapped.input), true)
  assert.equal(Object.isFrozen(mapped.input.resource), true)
  assert.equal(Object.isFrozen(mapped.input.metadata), true)

  const consumerFailure = await createRuntimeArtifactConsumptionAdapter({
    async consume() {
      return {
        ok: false,
        issues: [
          {
            code: 'RESOLUTION_FAILED',
            message: 'Runtime resource unavailable',
          },
        ],
      }
    },
  }).consume(reference)
  assertFailure(
    consumerFailure,
    'RESOLUTION_FAILED',
    'Consumer failure mapping',
  )

  const partialFailure = await createRuntimeArtifactConsumptionAdapter({
    async consume() {
      return {
        ok: false,
        issues: [
          {
            code: 'CONSUMPTION_FAILED',
            message: 'Partial input must be rejected',
          },
        ],
        input: {
          artifactId: reference.artifactId,
        },
      }
    },
  }).consume(reference)
  assertFailure(
    partialFailure,
    'CONSUMPTION_FAILED',
    'Partial failure input rejection',
  )

  const partialSuccess = await createRuntimeArtifactConsumptionAdapter({
    async consume() {
      return {
        ok: true,
        input: {
          artifactId: reference.artifactId,
          artifactType: 'video',
        },
      }
    },
  }).consume(reference)
  assertFailure(
    partialSuccess,
    'CONSUMPTION_FAILED',
    'Partial success input rejection',
  )

  const [runtimeDataTypes, runtimeContextTypes, renderer, app] = await readFiles([
    '../src/runtimeData/types.ts',
    '../src/runtime/context/types.ts',
    '../src/utils/sceneRenderer.tsx',
    '../src/App.tsx',
  ])
  const isolatedBoundaries = [
    ['RuntimeDataV2', runtimeDataTypes, true],
    ['RuntimeContext', runtimeContextTypes, true],
    ['Renderer', `${renderer}\n${app}`, false],
  ]
  for (const [label, source, forbidRuntimeInput] of isolatedBoundaries) {
    for (const forbidden of [
      'ArtifactRuntimeReference',
      'RuntimeArtifactConsumer',
      'RuntimeArtifactConsumptionAdapter',
      'RuntimeArtifactResolver',
      ...(forbidRuntimeInput ? ['RuntimeArtifactInput'] : []),
      'artifactId',
      'READY',
      'artifactLifecycle',
      'ArtifactLifecycle',
      'artifactStatus',
      'validationEvidence',
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${label}: ${forbidden} leaked`,
      )
    }
  }

  for (const forbidden of ['READY', 'validation', 'lifecycle', 'provider']) {
    assert.equal(
      JSON.stringify(success.input)
        .toLowerCase()
        .includes(forbidden.toLowerCase()),
      false,
      `RuntimeArtifactInput: ${forbidden} leaked`,
    )
  }

  console.log('Runtime Consumption Adapter MVP verification passed')
  console.log('validArtifactRuntimeReference = PASS')
  console.log('consumerSuccessMapping = PASS')
  console.log('consumerFailure = PASS')
  console.log('partialInputRejection = PASS')
  console.log('artifactLifecycleLeakage = ABSENT')
  console.log('runtimeDataV2Leakage = ABSENT')
  console.log('runtimeContextLeakage = ABSENT')
  console.log('rendererLeakage = ABSENT')
} finally {
  await server.close()
}
