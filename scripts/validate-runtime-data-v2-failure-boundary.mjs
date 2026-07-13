import { createServer } from 'vite'

const calls = {
  staticLoader: 0,
  generatedLoader: 0,
  validation: 0,
  consumption: 0,
  bootstrap: 0,
  readers: 0,
  services: 0,
  context: 0,
  debugSnapshot: 0,
}

const observedFunctions = new Map([
  ['/runtimeData/loaders/staticRuntimeDataV2Loader.ts', ['loadStaticRuntimeDataV2', 'staticLoader']],
  ['/runtimeData/loaders/generatedRuntimeDataV2Loader.ts', ['loadGeneratedRuntimeDataV2', 'generatedLoader']],
  ['/runtimeData/validation/validateRuntimeDataV2.ts', ['validateRuntimeDataV2', 'validation']],
  ['/runtimeData/consumption/createRuntimeDataV2Consumption.ts', ['createRuntimeDataV2Consumption', 'consumption']],
  ['/runtime/bootstrap/createRuntimeBootstrapV2.ts', ['createRuntimeBootstrapV2', 'bootstrap']],
  ['/runtimeData/readers/createRuntimeDataV2Readers.ts', ['createRuntimeDataV2Readers', 'readers']],
  ['/runtime/services/createRuntimeDataV2Services.ts', ['createRuntimeDataV2Services', 'services']],
  ['/runtime/context/createRuntimeContextV2.ts', ['createRuntimeContextV2', 'context']],
  ['/runtime/debug/createRuntimeDebugSnapshotV2.ts', ['createRuntimeDebugSnapshotV2', 'debugSnapshot']],
])

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
  plugins: [{
    name: 'failure-boundary-observer',
    enforce: 'post',
    transform(code, id) {
      const normalizedId = id.replaceAll('\\\\', '/')
      for (const [suffix, [functionName, counter]] of observedFunctions) {
        if (!normalizedId.endsWith(suffix)) continue
        const declaration = `function ${functionName}(`
        return code.replace(
          declaration,
          `function ${functionName}Observed(`,
        ).replace(
          `function ${functionName}Observed(`,
          `function ${functionName}(...args) { globalThis.__failureBoundaryCalls.${counter} += 1; return ${functionName}Observed(...args); } function ${functionName}Observed(`,
        )
      }
    },
  }],
})

globalThis.__failureBoundaryCalls = calls

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function snapshot() {
  return { ...calls }
}

function assertDelta(before, expected, label) {
  for (const key of Object.keys(calls)) {
    const actual = calls[key] - before[key]
    assert(actual === (expected[key] ?? 0), `${label}: ${key} calls ${actual}`)
  }
}

function assertThrows(action, pattern, label) {
  try {
    action()
  } catch (error) {
    assert(error instanceof Error, `${label}: expected Error`)
    assert(pattern.test(error.message), `${label}: unexpected error: ${error.message}`)
    return error
  }
  throw new Error(`${label}: expected failure`)
}

function assertTerminalResult(result, label) {
  assert(!result.ok, `${label}: expected validation failure`)
  assert(!('context' in result), `${label}: RuntimeContextV2 created`)
  assert(!('debugSnapshot' in result), `${label}: DebugSnapshotV2 created`)
  assert(!('services' in result), `${label}: Services leaked`)
  assert(!('data' in result), `${label}: RuntimeDataV2 leaked from failure result`)
}

function generatedSource(runtimeData, id = 'failure-boundary') {
  return {
    type: 'generated',
    artifactId: id,
    artifactRevision: '1',
    artifact: { runtimeData },
  }
}

try {
  const { createRuntimeApplicationV2 } =
    await server.ssrLoadModule('/src/runtime/application/index.ts')
  const { loadStaticRuntimeDataV2 } =
    await server.ssrLoadModule('/src/runtimeData/index.ts')
  const baseline = loadStaticRuntimeDataV2()
  calls.staticLoader = 0

  const resolverFailures = [
    ['Unknown source', { type: 'unknown' }, /Unknown RuntimeDataSourceV2 type/],
    ['Static missing sourceId', { type: 'static', revision: '1' }, /malformed/],
    ['Static missing revision', { type: 'static', sourceId: 'static' }, /malformed/],
    ['Generated missing artifactId', { type: 'generated', artifactRevision: '1', artifact: { runtimeData: baseline } }, /malformed/],
    ['Generated missing artifactRevision', { type: 'generated', artifactId: 'artifact', artifact: { runtimeData: baseline } }, /malformed/],
    ['Remote source', { type: 'remote', sourceId: 'remote', revision: '1', location: 'unused' }, /not implemented/],
  ]
  for (const [label, source, pattern] of resolverFailures) {
    const before = snapshot()
    assertThrows(() => createRuntimeApplicationV2({ source }), pattern, label)
    assertDelta(before, {}, label)
  }

  const artifactFailures = [
    ['Missing runtimeData', { metadata: 'only' }, /missing runtimeData/],
    ['Malformed envelope null', null, /must be an object/],
    ['Malformed envelope array', [], /must be an object/],
  ]
  for (const [label, artifact, pattern] of artifactFailures) {
    const before = snapshot()
    assertThrows(
      () => createRuntimeApplicationV2({ source: { type: 'generated', artifactId: label, artifactRevision: '1', artifact } }),
      pattern,
      label,
    )
    assertDelta(before, { generatedLoader: 1 }, label)
  }

  for (const domain of ['effect', 'depth', 'composition', 'audio']) {
    const { [domain]: removed, ...partial } = baseline
    assert(removed !== undefined, `${domain}: baseline fixture missing domain`)
    const before = snapshot()
    const result = createRuntimeApplicationV2({ source: generatedSource(partial, `missing-${domain}`) })
    assertTerminalResult(result, `Missing ${domain}`)
    assert(result.issues.some((issue) => issue.path === domain), `Missing ${domain}: issue absent`)
    assertDelta(before, { generatedLoader: 1, validation: 1 }, `Missing ${domain}`)
  }

  const durationMismatch = {
    ...baseline,
    project: { ...baseline.project, duration: baseline.timeline.duration - 1 },
  }
  let before = snapshot()
  let result = createRuntimeApplicationV2({ source: generatedSource(durationMismatch, 'duration-mismatch') })
  assertTerminalResult(result, 'Invalid duration')
  assert(result.issues.some((issue) => issue.code === 'PROJECT_TIMELINE_DURATION_MISMATCH'), 'Invalid duration: issue absent')
  assertDelta(before, { generatedLoader: 1, validation: 1 }, 'Invalid duration')

  const effectWithGap = baseline.effect.map((track, index) =>
    index === 0 ? { ...track, start: track.start + 1, duration: track.duration - 1 } : track,
  )
  before = snapshot()
  result = createRuntimeApplicationV2({
    source: generatedSource({ ...baseline, effect: effectWithGap }, 'coverage-gap'),
  })
  assertTerminalResult(result, 'Invalid timeline coverage')
  assert(result.issues.some((issue) => issue.code === 'DURATION_COVERAGE_MISMATCH'), 'Invalid timeline coverage: issue absent')
  assertDelta(before, { generatedLoader: 1, validation: 1 }, 'Invalid timeline coverage')

  console.log('RuntimeDataV2 failure boundary verification passed')
  console.log('sourceResolverFailures = PASS')
  console.log('generatedArtifactFailures = PASS')
  console.log('validationFailures = PASS')
  console.log('initializationSafety = PASS')
  console.log('authorityLeakage = PASS')
  console.log('fallbackAndDomainMerge = ABSENT')
} finally {
  delete globalThis.__failureBoundaryCalls
  await server.close()
}
