import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const reference = Object.freeze({
  artifactId: 'artifact-runtime-completion-001',
  artifactType: 'video',
  location: Object.freeze({
    type: 'local-file',
    path: 'output/artifacts/videos/artifact-runtime-completion-001.mp4',
  }),
  metadata: Object.freeze({
    mimeType: 'video/mp4',
    size: 4096,
    duration: 5,
    width: 1920,
    height: 1080,
  }),
})

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

try {
  const [{ createRuntimeApplicationV2 }, { renderRuntimeArtifactInput }] =
    await Promise.all([
      server.ssrLoadModule('/src/runtime/index.ts'),
      server.ssrLoadModule('/src/utils/sceneRenderer.tsx'),
    ])

  const application = createRuntimeApplicationV2()
  assert.equal(application.ok, true, 'Runtime application must initialize')

  const { context } = application
  assert.equal(
    context.artifact,
    context.services.artifact,
    'RuntimeContext must expose the Runtime Services Artifact capability',
  )

  const result = await context.artifact.consume(reference)
  assert.equal(
    result.ok,
    true,
    'ArtifactRuntimeReference consumption success path must succeed',
  )
  assert.deepEqual(result.input, {
    artifactId: 'artifact-runtime-completion-001',
    artifactType: 'video',
    resource: {
      type: 'runtime-video-source',
      source: 'output/artifacts/videos/artifact-runtime-completion-001.mp4',
    },
    metadata: {
      mimeType: 'video/mp4',
      size: 4096,
      duration: 5,
      width: 1920,
      height: 1080,
    },
  })
  assert.equal(Object.isFrozen(result.input), true)
  assert.equal(Object.isFrozen(result.input.resource), true)
  assert.equal(Object.isFrozen(result.input.metadata), true)

  const rendered = renderToStaticMarkup(renderRuntimeArtifactInput(result.input))
  assert.match(rendered, /^<video /)
  assert.match(
    rendered,
    /src="output\/artifacts\/videos\/artifact-runtime-completion-001\.mp4"/,
  )
  assert.match(rendered, /width="1920"/)
  assert.match(rendered, /height="1080"/)

  const [
    runtimeDataTypes,
    contextTypes,
    contextFactory,
    renderer,
  ] = await Promise.all([
    readSource('../src/runtimeData/types.ts'),
    readSource('../src/runtime/context/types.ts'),
    readSource('../src/runtime/context/createRuntimeContextV2.ts'),
    readSource('../src/utils/sceneRenderer.tsx'),
  ])

  const runtimeDataV2Contract = runtimeDataTypes.match(
    /export interface RuntimeDataV2 extends RuntimeDataV1 \{([\s\S]*?)\n\}/,
  )
  assert.ok(runtimeDataV2Contract, 'RuntimeDataV2 contract not found')
  assert.deepEqual(
    [...runtimeDataV2Contract[1].matchAll(/readonly\s+(\w+):/g)].map(
      ([, field]) => field,
    ),
    ['effect', 'depth', 'composition', 'audio'],
    'RuntimeDataV2 contract changed',
  )

  assert.match(contextTypes, /readonly artifact: RuntimeArtifactService/)
  assert.match(contextFactory, /artifact: services\.artifact/)

  for (const forbidden of [
    'ArtifactEnvelope',
    'READY',
    'validationEvidence',
    'artifactLifecycle',
    'Production',
    'Provider',
  ]) {
    assert.equal(
      `${contextTypes}\n${contextFactory}`.includes(forbidden),
      false,
      `RuntimeContext ownership leakage: ${forbidden}`,
    )
  }

  assert.match(renderer, /RuntimeArtifactInput/)
  for (const forbidden of [
    'ArtifactRuntimeReference',
    'RuntimeArtifactConsumer',
    'RuntimeArtifactConsumptionAdapter',
    'RuntimeArtifactResolver',
    '../artifacts',
    'Storage',
    'Provider',
    'Production',
    'READY',
  ]) {
    assert.equal(
      renderer.includes(forbidden),
      false,
      `Renderer boundary leakage: ${forbidden}`,
    )
  }

  for (const forbidden of [
    'ArtifactRuntimeReference',
    'RuntimeArtifactInput',
    'artifactId',
    'READY',
    'validationEvidence',
    'artifactLifecycle',
  ]) {
    assert.equal(
      runtimeDataTypes.includes(forbidden),
      false,
      `RuntimeDataV2 boundary leakage: ${forbidden}`,
    )
  }

  console.log('Runtime Consumption Completion verification passed')
  console.log('artifactRuntimeReferenceConsumption = PASS')
  console.log('runtimeArtifactServiceSuccessPath = PASS')
  console.log('runtimeContextExposure = PASS')
  console.log('rendererBoundaryIsolation = PASS')
  console.log('runtimeDataV2Unchanged = PASS')
  console.log('runtimeIsolation = PASS')
} finally {
  await server.close()
}
