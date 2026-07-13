import { createServer } from 'vite'

const loaderCalls = { static: 0, generated: 0 }

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
  plugins: [
    {
      name: 'dual-source-loader-observer',
      enforce: 'post',
      transform(code, id) {
        const normalizedId = id.replaceAll('\\\\', '/')
        if (normalizedId.endsWith('/runtimeData/loaders/staticRuntimeDataV2Loader.ts')) {
          return code.replace(
            'function loadStaticRuntimeDataV2()',
            'function loadStaticRuntimeDataV2() { globalThis.__dualSourceLoaderCalls.static += 1; return loadStaticRuntimeDataV2Observed(); } function loadStaticRuntimeDataV2Observed()',
          )
        }
        if (normalizedId.endsWith('/runtimeData/loaders/generatedRuntimeDataV2Loader.ts')) {
          return code.replace(
            'function loadGeneratedRuntimeDataV2(artifact)',
            'function loadGeneratedRuntimeDataV2(artifact) { globalThis.__dualSourceLoaderCalls.generated += 1; return loadGeneratedRuntimeDataV2Observed(artifact); } function loadGeneratedRuntimeDataV2Observed(artifact)',
          )
        }
      },
    },
  ],
})

globalThis.__dualSourceLoaderCalls = loaderCalls

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertThrows(action, messagePattern, label) {
  try {
    action()
  } catch (error) {
    assert(error instanceof Error, `${label}: expected Error`)
    assert(messagePattern.test(error.message), `${label}: unexpected error: ${error.message}`)
    return
  }
  throw new Error(`${label}: expected failure`)
}

function snapshotCalls() {
  return { ...loaderCalls }
}

function assertCallDelta(before, expected, label) {
  assert(
    loaderCalls.static - before.static === expected.static,
    `${label}: unexpected Static loader call count`,
  )
  assert(
    loaderCalls.generated - before.generated === expected.generated,
    `${label}: unexpected Generated loader call count`,
  )
}

function assertSuccessfulApplication(result, label) {
  assert(result.ok, `${label}: application was not created`)
  assert(result.context.readiness.ready, `${label}: RuntimeContextV2 was not ready`)
  assert(result.context.state.status === 'ready', `${label}: lifecycle was not ready`)
  assert(result.debugSnapshot.readiness.ready, `${label}: DebugSnapshotV2 was not ready`)
  assert(result.debugSnapshot.bootstrap.ready, `${label}: Bootstrap was not ready`)

  const serviceNames = [
    'project', 'playback', 'scene', 'subtitle', 'camera',
    'effect', 'depth', 'composition', 'audio',
  ]
  for (const serviceName of serviceNames) {
    assert(result.context.services[serviceName], `${label}: ${serviceName} service unavailable`)
  }
  return result
}

function runtimeContract(result) {
  return {
    context: {
      readiness: result.context.readiness,
      state: result.context.state,
      serviceNames: Object.keys(result.context.services).sort(),
    },
    debugSnapshot: {
      keys: Object.keys(result.debugSnapshot).sort(),
      readiness: result.debugSnapshot.readiness,
      context: result.debugSnapshot.context,
      bootstrap: result.debugSnapshot.bootstrap,
      readerKeys: Object.keys(result.debugSnapshot.readers).sort(),
      serviceKeys: Object.keys(result.debugSnapshot.services).sort(),
      domainCount: result.debugSnapshot.services.domainCount,
    },
  }
}

try {
  const { createRuntimeApplicationV2 } =
    await server.ssrLoadModule('/src/runtime/application/index.ts')
  const { createGeneratedRuntimeDataV2Source, loadStaticRuntimeDataV2 } =
    await server.ssrLoadModule('/src/runtimeData/index.ts')

  let before = snapshotCalls()
  const staticApplication = assertSuccessfulApplication(
    createRuntimeApplicationV2({
      source: {
        type: 'static',
        sourceId: 'static-runtime-data-v2',
        revision: 'milestone-2a-task-a3',
      },
    }),
    'Static path',
  )
  assertCallDelta(before, { static: 1, generated: 0 }, 'Static path isolation')

  const generatedSource = createGeneratedRuntimeDataV2Source()
  before = snapshotCalls()
  const generatedApplication = assertSuccessfulApplication(
    createRuntimeApplicationV2({ source: generatedSource }),
    'Generated path',
  )
  assertCallDelta(before, { static: 0, generated: 1 }, 'Generated path isolation')

  assert(
    JSON.stringify(runtimeContract(staticApplication)) ===
      JSON.stringify(runtimeContract(generatedApplication)),
    'Static and Generated Runtime contracts differ',
  )

  before = snapshotCalls()
  const staticDescriptorWithGeneratedFields = createRuntimeApplicationV2({
    source: {
      type: 'static',
      sourceId: 'static-atomicity-check',
      revision: '1',
      artifact: generatedSource.artifact,
    },
  })
  assert(staticDescriptorWithGeneratedFields.ok, 'Static atomic source check failed')
  assertCallDelta(before, { static: 1, generated: 0 }, 'Static atomic source')

  before = snapshotCalls()
  const generatedDescriptorWithStaticFields = createRuntimeApplicationV2({
    source: {
      ...generatedSource,
      sourceId: 'must-not-select-static',
      revision: 'must-not-select-static',
    },
  })
  assert(generatedDescriptorWithStaticFields.ok, 'Generated atomic source check failed')
  assertCallDelta(before, { static: 0, generated: 1 }, 'Generated atomic source')

  const completeRuntimeData = loadStaticRuntimeDataV2()
  before = snapshotCalls()
  const partialGenerated = createRuntimeApplicationV2({
    source: {
      type: 'generated',
      artifactId: 'partial-runtime-data',
      artifactRevision: '1',
      artifact: { runtimeData: { project: completeRuntimeData.project } },
    },
  })
  assert(!partialGenerated.ok, 'Partial RuntimeDataV2 must fail validation')
  assertCallDelta(before, { static: 0, generated: 1 }, 'Partial Generated source')

  before = snapshotCalls()
  assertThrows(
    () => createRuntimeApplicationV2({
      source: {
        type: 'generated', artifactId: 'malformed', artifactRevision: '1', artifact: {},
      },
    }),
    /missing runtimeData/,
    'Malformed Generated artifact',
  )
  assertCallDelta(before, { static: 0, generated: 1 }, 'Malformed Generated failure boundary')

  before = snapshotCalls()
  const invalidGenerated = createRuntimeApplicationV2({
    source: {
      type: 'generated',
      artifactId: 'invalid-runtime-data',
      artifactRevision: '1',
      artifact: { runtimeData: {} },
    },
  })
  assert(!invalidGenerated.ok, 'Invalid Generated RuntimeDataV2 must fail validation')
  assert(!('context' in invalidGenerated), 'Invalid Generated data created RuntimeContextV2')
  assertCallDelta(before, { static: 0, generated: 1 }, 'Invalid Generated failure boundary')

  before = snapshotCalls()
  assertThrows(
    () => createRuntimeApplicationV2({
      source: { type: 'static', sourceId: '', revision: 1 },
    }),
    /malformed/,
    'Invalid Static source',
  )
  assertCallDelta(before, { static: 0, generated: 0 }, 'Invalid Static failure boundary')

  console.log('RuntimeDataV2 dual source verification passed')
  console.log('staticApplication = PASS')
  console.log('generatedApplication = PASS')
  console.log('runtimeBackboneEquivalence = PASS')
  console.log('runtimeContextContract = PASS')
  console.log('debugSnapshotContract = PASS')
  console.log('sourceIsolation = PASS')
  console.log('atomicSource = PASS')
  console.log('failureBoundaries = PASS')
} finally {
  delete globalThis.__dualSourceLoaderCalls
  await server.close()
}
