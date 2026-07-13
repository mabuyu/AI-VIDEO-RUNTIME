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
  const application = await server.ssrLoadModule('/src/runtime/application/index.ts')
  const runtimeData = await server.ssrLoadModule('/src/runtimeData/index.ts')

  const source = runtimeData.createGeneratedRuntimeDataV2Source()
  assert(source.type === 'generated', 'GeneratedRuntimeDataV2Source was not created')

  const candidate = runtimeData.resolveRuntimeDataSourceV2(source)
  assert(candidate === source.artifact.runtimeData, 'Resolver did not extract artifact.runtimeData')

  const result = application.createGeneratedRuntimeApplicationV2()
  assert(result.ok, 'Generated RuntimeApplicationV2 initialization failed')
  assert(result.context.readiness.ready, 'RuntimeContextV2 is not ready')
  assert(result.debugSnapshot.readiness.ready, 'DebugSnapshotV2 is not ready')
  assert(
    result.context.services.project.getProjectTitle() === candidate.project.title,
    'Services did not consume the Generated RuntimeDataV2 payload',
  )
  assert(!('artifact' in result.context), 'Artifact envelope leaked into RuntimeContextV2')
  assert(!('generation' in result.context), 'Generation metadata leaked into RuntimeContextV2')

  assertThrows(
    () => runtimeData.resolveRuntimeDataSourceV2({
      type: 'generated', artifactId: 'missing', artifactRevision: '1',
    }),
    /malformed/,
    'Missing artifact',
  )
  assertThrows(
    () => runtimeData.resolveRuntimeDataSourceV2({
      type: 'generated', artifactId: 'malformed', artifactRevision: '1', artifact: {},
    }),
    /missing runtimeData/,
    'Malformed artifact',
  )
  const invalid = application.createRuntimeApplicationV2({
    source: {
      type: 'generated',
      artifactId: 'invalid-runtime-data',
      artifactRevision: '1',
      artifact: { runtimeData: {} },
    },
  })
  assert(!invalid.ok, 'Invalid RuntimeDataV2 must fail validation')
  assertThrows(
    () => runtimeData.resolveRuntimeDataSourceV2({
      type: 'remote', sourceId: 'remote', revision: '1', location: 'not-used',
    }),
    /not implemented/,
    'Remote source',
  )

  console.log('Generated RuntimeDataV2 activation smoke passed')
  console.log('generatedSource = PASS')
  console.log('generatedResolver = PASS')
  console.log('generatedApplication = PASS')
  console.log('runtimeContextReady = PASS')
  console.log('metadataBoundary = PASS')
  console.log('failureStrategy = PASS')
} finally {
  await server.close()
}
