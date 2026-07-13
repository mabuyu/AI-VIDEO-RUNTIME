import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

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

try {
  const { createRuntimeApplicationV2 } =
    await server.ssrLoadModule('/src/runtime/application/index.ts')
  const { loadStaticRuntimeDataV2 } =
    await server.ssrLoadModule('/src/runtimeData/index.ts')

  const staticApplication = createRuntimeApplicationV2({
    source: {
      type: 'static',
      sourceId: 'static-runtime-data-v2',
      revision: 'milestone-2a-task-a1',
    },
  })
  assert(staticApplication.ok, 'Static source application initialization failed')

  const generatedApplication = createRuntimeApplicationV2({
    source: {
      type: 'generated',
      artifactId: 'generated-boundary-smoke',
      artifactRevision: '1',
      artifact: { runtimeData: loadStaticRuntimeDataV2() },
    },
  })
  assert(generatedApplication.ok, 'Generated source did not enter the application resolver boundary')

  assertThrows(
    () => createRuntimeApplicationV2(),
    /requires an explicit source/,
    'Missing source',
  )

  assertThrows(
    () => createRuntimeApplicationV2({ source: { type: 'unknown' } }),
    /Unknown RuntimeDataSourceV2 type/,
    'Invalid source',
  )

  console.log('RuntimeApplicationV2 source injection smoke passed')
  console.log('staticSourceInjection = PASS')
  console.log('generatedSourceResolverBoundary = PASS')
  console.log('missingSource = PASS')
  console.log('invalidSource = PASS')
} finally {
  await server.close()
}
