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
  const { resolveRuntimeDataSourceV2 } =
    await server.ssrLoadModule('/src/runtimeData/index.ts')

  const staticCandidate = resolveRuntimeDataSourceV2({
    type: 'static',
    sourceId: 'static-runtime-data-v2',
    revision: 'day17',
  })
  assert(staticCandidate.timeline !== undefined, 'Static source did not load RuntimeDataV2')

  const unvalidatedPayload = {}
  const generatedCandidate = resolveRuntimeDataSourceV2({
    type: 'generated',
    artifactId: 'artifact-day17-smoke',
    artifactRevision: '1',
    artifact: { runtimeData: unvalidatedPayload },
  })
  assert(
    generatedCandidate === unvalidatedPayload,
    'Generated resolver must return the loader candidate unchanged',
  )

  assertThrows(
    () => resolveRuntimeDataSourceV2({ type: 'unknown' }),
    /Unknown RuntimeDataSourceV2 type/,
    'Unknown source',
  )

  assertThrows(
    () =>
      resolveRuntimeDataSourceV2({
        type: 'generated',
        artifactId: 'malformed-artifact',
        artifactRevision: '1',
        artifact: {},
      }),
    /missing runtimeData/,
    'Malformed generated artifact',
  )

  console.log('RuntimeDataSourceV2 smoke passed')
  console.log('staticSource = PASS')
  console.log('generatedSource = PASS')
  console.log('unknownSource = PASS')
  console.log('malformedGeneratedArtifact = PASS')
  console.log('resolverDoesNotValidatePayload = PASS')
} finally {
  await server.close()
}
