import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { adaptPromptSemanticIntent } = await server.ssrLoadModule('/src/compiler/input/index.ts')
  const { compileMvpScenario, createMvpCompilerAdapterInput } = await server.ssrLoadModule('/src/compiler/mvpScenario/index.ts')
  const { adaptCompilerOutputToRuntimeDataV2 } = await server.ssrLoadModule('/src/compiler/runtimeDataV2/index.ts')
  const { packageCompilerArtifactOutput } = await server.ssrLoadModule('/src/compiler/artifact/index.ts')
  const { createRuntimeApplicationV2 } = await server.ssrLoadModule('/src/runtime/application/index.ts')

  const duration = { value: 30, unit: 'seconds', flexibility: 'exact' }
  const controlledPrompt = {
    promptContractVersion: '1',
    intent: {
      project: { title: 'Nova Product Launch', purpose: 'Promote a product', targetDuration: duration, audience: 'Product buyers' },
      content: { topic: 'Nova', message: 'Meet the simpler way to create', keyPoints: ['Fast setup', 'Clear results', 'Start today'] },
      style: { visualStyle: 'minimal product film', tone: 'confident', pace: 'progressive', atmosphere: 'premium' },
      timeline: { pacing: 'intro feature outro', structure: 'three-phase product promotion', emphasis: ['product', 'benefit', 'call to action'] },
      scenes: [
        { id: 'intro', purpose: 'introduce', message: 'Meet Nova', durationIntent: duration, transitionIntent: 'fade-in' },
        { id: 'feature', purpose: 'demonstrate', message: 'Create faster with one focused workflow', durationIntent: duration, transitionIntent: 'clean-cut' },
        { id: 'outro', purpose: 'convert', message: 'Start creating today', durationIntent: duration, transitionIntent: 'fade-out' },
      ],
      audio: { intent: 'voiceover', mood: 'uplifting', voice: 'clear neutral', silencePreference: 'brief pauses' },
    },
  }
  const metadata = {
    artifact: { id: 'mvp-nova-product-promo', revision: '1', createdAt: '2026-07-14T00:00:00.000Z' },
    compatibility: { schemaVersion: '1', runtimeSchemaVersion: '2' },
    generation: { compilerVersion: 'mvp-scenario-1.0.0', promptContractVersion: '1', generatedAt: '2026-07-14T00:00:00.000Z' },
  }

  const adapted = adaptPromptSemanticIntent(controlledPrompt)
  assert.equal(adapted.success, true, 'controlled prompt input')
  const compiled = compileMvpScenario(adapted.input)
  assert.equal(compiled.success, true, 'compiler generation')
  assert.deepEqual(compiled.output.scenes.map(({ start, duration }) => [start, duration]), [[0, 6000], [6000, 18000], [24000, 6000]])
  const runtimeResult = adaptCompilerOutputToRuntimeDataV2(createMvpCompilerAdapterInput(compiled.output, metadata))
  assert.equal(runtimeResult.success, true, 'runtimeDataV2 creation')
  assert.deepEqual(Object.keys(runtimeResult.output.runtimeData), ['project', 'scenes', 'subtitles', 'timeline', 'camera', 'effect', 'depth', 'composition', 'audio'])
  assert.notEqual(runtimeResult.output.runtimeData.audio.length, 0)
  const packaged = packageCompilerArtifactOutput(runtimeResult.output)
  assert.equal(packaged.success, true, 'artifact packaging')
  const application = createRuntimeApplicationV2({ source: { type: 'generated', artifactId: packaged.envelope.artifact.id, artifactRevision: packaged.envelope.artifact.revision, artifact: packaged.envelope } })
  assert.equal(application.ok, true, `runtime activation: ${application.ok ? '' : JSON.stringify(application.issues)}`)
  assert.equal(application.context.services.playback.getTimelineDuration(), 30_000)

  const invalidSemantic = structuredClone(controlledPrompt)
  delete invalidSemantic.intent.project.title
  assert.equal(adaptPromptSemanticIntent(invalidSemantic).success, false, 'invalid semantic input must fail')
  assert.equal(compileMvpScenario({}).success, false, 'missing compiler output must fail')
  const incomplete = createMvpCompilerAdapterInput(compiled.output, metadata)
  delete incomplete.depth
  const incompleteResult = adaptCompilerOutputToRuntimeDataV2(incomplete)
  assert.equal(incompleteResult.success, false, 'incomplete runtime domain must fail')
  assert.equal('output' in incompleteResult, false)

  console.log('First Prompt Generated Video MVP verification passed')
} finally {
  await server.close()
}
