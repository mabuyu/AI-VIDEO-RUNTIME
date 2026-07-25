import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const reference = Object.freeze({
  artifactId: 'artifact-runtime-services-001',
  artifactType: 'video',
  location: Object.freeze({
    type: 'local-file',
    path: 'output/artifacts/videos/artifact-runtime-services-001.mp4',
  }),
  metadata: Object.freeze({
    mimeType: 'video/mp4',
    size: 4096,
    duration: 5,
    width: 1920,
    height: 1080,
  }),
})

function createReaders() {
  return {
    project: {},
    timeline: {},
    scene: {},
    subtitle: {},
    camera: {},
  }
}

function assertFailure(result, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'])
  assert.equal('input' in result, false, `${label}: partial input leaked`)
  assert.equal(result.issues.length > 0, true, `${label}: issues missing`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
  assert.equal(
    result.issues.every((issue) => Object.isFrozen(issue)),
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
  const { createRuntimeServices } =
    await server.ssrLoadModule('/src/runtime/services/index.ts')

  const services = createRuntimeServices(createReaders())
  const success = await services.artifact.consume(reference)

  assert.equal(success.ok, true, 'Service success path must succeed')
  assert.deepEqual(success.input, {
    artifactId: 'artifact-runtime-services-001',
    artifactType: 'video',
    resource: {
      type: 'runtime-video-source',
      source: 'output/artifacts/videos/artifact-runtime-services-001.mp4',
    },
    metadata: {
      mimeType: 'video/mp4',
      size: 4096,
      duration: 5,
      width: 1920,
      height: 1080,
    },
  })
  assert.equal(Object.isFrozen(services.artifact), true)
  assert.equal(Object.isFrozen(success), true)
  assert.equal(Object.isFrozen(success.input), true)
  assert.equal(Object.isFrozen(success.input.resource), true)
  assert.equal(Object.isFrozen(success.input.metadata), true)

  const failure = await services.artifact.consume({
    ...reference,
    location: { type: 'remote-url', path: reference.location.path },
  })
  assertFailure(failure, 'Service failure path')

  let delegationCount = 0
  const delegatedResult = Object.freeze({
    ok: true,
    input: Object.freeze({
      artifactId: reference.artifactId,
      artifactType: 'video',
      resource: Object.freeze({
        type: 'runtime-video-source',
        source: reference.location.path,
      }),
      metadata: Object.freeze({
        mimeType: 'video/mp4',
        size: reference.metadata.size,
      }),
    }),
  })
  const delegatedServices = createRuntimeServices(createReaders(), {
    async consume(receivedReference) {
      delegationCount += 1
      assert.equal(receivedReference, reference)
      return delegatedResult
    },
  })
  assert.equal(
    await delegatedServices.artifact.consume(reference),
    delegatedResult,
    'Runtime Artifact Service must preserve the Adapter result',
  )
  assert.equal(delegationCount, 1, 'Adapter must be delegated exactly once')

  const throwingServices = createRuntimeServices(createReaders(), {
    async consume() {
      throw new Error('adapter failure')
    },
  })
  assertFailure(
    await throwingServices.artifact.consume(reference),
    'Throwing Adapter failure',
  )

  const [
    serviceFactory,
    artifactService,
    runtimeDataTypes,
    runtimeContextTypes,
    renderer,
    app,
  ] = await readFiles([
    '../src/runtime/services/createRuntimeServices.ts',
    '../src/runtime/services/artifact/createRuntimeArtifactService.ts',
    '../src/runtimeData/types.ts',
    '../src/runtime/context/types.ts',
    '../src/utils/sceneRenderer.tsx',
    '../src/App.tsx',
  ])

  assert.equal(
    serviceFactory.includes('createRuntimeArtifactConsumer'),
    false,
    'Runtime Services created a duplicate Consumer',
  )
  assert.equal(
    serviceFactory.includes('createRuntimeArtifactConsumptionAdapter'),
    false,
    'Runtime Services bypassed the injected Adapter',
  )

  for (const forbidden of [
    'ArtifactEnvelope',
    'validateArtifact',
    'READY',
    'lifecycle',
    'provider',
    'storage',
  ]) {
    assert.equal(
      `${serviceFactory}\n${artifactService}`
        .toLowerCase()
        .includes(forbidden.toLowerCase()),
      false,
      `Runtime Services: ${forbidden} leaked`,
    )
  }

  const isolatedBoundaries = [
    ['RuntimeDataV2', runtimeDataTypes],
    ['RuntimeContext', runtimeContextTypes],
    ['Renderer', `${renderer}\n${app}`],
  ]
  for (const [label, source] of isolatedBoundaries) {
    for (const forbidden of [
      'ArtifactRuntimeReference',
      'RuntimeArtifactConsumer',
      'RuntimeArtifactConsumptionAdapter',
      'RuntimeArtifactResolver',
      'RuntimeArtifactInput',
      'artifactId',
      'READY',
      'validationEvidence',
      'artifactLifecycle',
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${label}: ${forbidden} leaked`,
      )
    }
  }

  console.log('Runtime Services Artifact Consumption verification passed')
  console.log('serviceSuccessPath = PASS')
  console.log('serviceFailurePath = PASS')
  console.log('adapterDelegation = PASS')
  console.log('duplicateConsumer = ABSENT')
  console.log('artifactLifecycleLeakage = ABSENT')
  console.log('runtimeDataV2Leakage = ABSENT')
  console.log('runtimeContextLeakage = ABSENT')
  console.log('rendererLeakage = ABSENT')
} finally {
  await server.close()
}
