import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { adaptScenarioCompilerBundle } = await server.ssrLoadModule('/src/compiler/runtimeDataV2/index.ts')
  const generationId = 'generation-b8-4'
  const duration = 1000
  const bundle = {
    generationId,
    scene: {
      project: { title: 'Generated', author: 'Compiler', version: '2', fps: 30, width: 1080, height: 1920, duration, background: '#000' },
      scenes: [{ scene: 'hook', start: 0, duration, text: 'x', highlight: 'x', background: '#000', position: 'center', animation: 'none', camera: { scaleFrom: 1, scaleTo: 1, xFrom: 0, xTo: 0, yFrom: 0, yTo: 0, shake: 0 } }],
      subtitles: [{ id: 'subtitle-1', start: 0, duration, text: 'x' }],
    },
    timeline: { timeline: { fps: 30, duration, tracks: ['scene', 'subtitle', 'camera', 'effect', 'depth', 'composition', 'audio'].map((type) => ({ id: `${type}-main`, type, source: `${type}.json`, enabled: true })) } },
    camera: { tracks: [{ id: 'camera-1', start: 0, duration, scaleFrom: 1, scaleTo: 1, xFrom: 0, xTo: 0, yFrom: 0, yTo: 0, shake: 0 }] },
    effect: { tracks: [{ id: 'effect-1', start: 0, duration, effect: 'clean', parameters: {} }] },
    depth: { tracks: [{ id: 'depth-1', start: 0, duration, depth: 'balanced', parameters: {} }] },
    composition: { tracks: [{ id: 'composition-1', start: 0, duration, composition: 'hook', parameters: {} }] },
    audio: { duration, tracks: [{ id: 'audio-1', type: 'silence', start: 0, duration, volume: 0, segments: [{ start: 0, duration }] }] },
  }
  const handoff = {
    generationId,
    bundle,
    artifact: { id: 'artifact-1', revision: '1', createdAt: '2026-07-15T00:00:00.000Z' },
    compatibility: { schemaVersion: '1', runtimeSchemaVersion: '2' },
    generation: { compilerVersion: '2.0.0', promptContractVersion: '1', generatedAt: '2026-07-15T00:00:00.000Z' },
    diagnostics: [],
  }

  const complete = adaptScenarioCompilerBundle(handoff)
  assert.equal(complete.success, true)
  assert.equal(complete.output.runtimeData.project, bundle.scene.project)
  assert.equal(complete.output.runtimeData.timeline, bundle.timeline.timeline)
  assert.equal(complete.output.runtimeData.camera, bundle.camera.tracks)
  assert.equal(complete.output.runtimeData.effect[0].preset, 'clean')
  assert.equal(complete.output.runtimeData.depth[0].preset, 'balanced')
  assert.equal(complete.output.runtimeData.composition[0].preset, 'hook')
  assert.equal(complete.output.runtimeData.audio, bundle.audio.tracks)

  const incompleteBundle = { ...bundle }
  delete incompleteBundle.depth
  const incomplete = adaptScenarioCompilerBundle({ ...handoff, bundle: incompleteBundle })
  assert.equal(incomplete.success, false)
  assert.equal('output' in incomplete, false)

  let adapterCalls = 0
  const compilerFailure = { success: false, issues: [{ code: 'PRODUCER_GENERATION_FAILED', message: 'failed' }] }
  if (compilerFailure.success) {
    adapterCalls += 1
    adaptScenarioCompilerBundle({ ...handoff, bundle: compilerFailure.output })
  }
  assert.equal(adapterCalls, 0)

  const adapterFailure = adaptScenarioCompilerBundle({ ...handoff, bundle: { ...bundle, timeline: { timeline: { ...bundle.timeline.timeline, duration: duration + 1 } } } })
  assert.equal(adapterFailure.success, false)
  assert.equal('output' in adapterFailure, false)

  const unmappable = adaptScenarioCompilerBundle({
    ...handoff,
    bundle: { ...bundle, effect: { tracks: [{ ...bundle.effect.tracks[0], parameters: { intensity: 0.5 } }] } },
  })
  assert.equal(unmappable.success, false)
  assert.equal('output' in unmappable, false)
  assert.equal(unmappable.issues[0].code, 'UNMAPPABLE_DOMAIN_PARAMETERS')

  const mismatch = adaptScenarioCompilerBundle({ ...handoff, generationId: 'generation-other' })
  assert.equal(mismatch.success, false)
  assert.equal('output' in mismatch, false)
  assert.equal(mismatch.issues[0].code, 'GENERATION_ID_MISMATCH')

  console.log('Scenario Compiler -> RuntimeDataV2 Adapter handoff verification passed')
} finally {
  await server.close()
}
