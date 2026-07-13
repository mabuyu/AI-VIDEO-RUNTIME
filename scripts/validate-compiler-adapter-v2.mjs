import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { adaptCompilerOutputToRuntimeDataV2 } = await server.ssrLoadModule('/src/compiler/runtimeDataV2/index.ts')
  const duration = 1000
  const success = (tracks, extra = {}) => ({ success: true, value: { tracks, ...extra }, issues: [] })
  const base = {
    project: { title: 'Generated', author: 'Compiler', version: '2', fps: 30, width: 1080, height: 1920, duration, background: '#000' },
    scenes: [{ scene: 'hook', start: 0, duration, text: 'x', highlight: 'x', background: '#000', position: 'center', animation: 'none', camera: { scaleFrom: 1, scaleTo: 1, xFrom: 0, xTo: 0, yFrom: 0, yTo: 0, shake: 0 } }],
    subtitles: [{ id: 'subtitle-1', start: 0, duration, text: 'x' }],
    timeline: { fps: 30, duration, tracks: ['scene', 'subtitle', 'camera', 'effect', 'depth', 'composition', 'audio'].map((type) => ({ id: `${type}-main`, type, source: `${type}.json`, enabled: true })) },
    camera: [{ id: 'camera-1', start: 0, duration, scaleFrom: 1, scaleTo: 1, xFrom: 0, xTo: 0, yFrom: 0, yTo: 0, shake: 0 }],
    effect: success([{ id: 'effect-1', start: 0, duration, preset: 'clean' }]),
    depth: success([{ id: 'depth-1', start: 0, duration, preset: 'balanced' }]),
    composition: success([{ id: 'composition-1', start: 0, duration, preset: 'hook' }]),
    audio: success([{ id: 'audio-1', type: 'generated-audio', start: 0, duration, volume: 0.8, segments: [{ start: 0, duration, audioRef: 'audio://generated/main' }] }], { duration }),
    artifact: { id: 'artifact-1', revision: '1', createdAt: '2026-07-13T00:00:00.000Z' },
    compatibility: { schemaVersion: '1', runtimeSchemaVersion: '2' },
    generation: { compilerVersion: '2.0.0', promptContractVersion: '1', generatedAt: '2026-07-13T00:00:00.000Z' },
    diagnostics: [],
  }

  const complete = adaptCompilerOutputToRuntimeDataV2(base)
  assert.equal(complete.success, true)
  assert.deepEqual(Object.keys(complete.output.runtimeData), ['project', 'scenes', 'subtitles', 'timeline', 'camera', 'effect', 'depth', 'composition', 'audio'])
  assert.equal(complete.output.runtimeData.audio[0].segments[0].audioRef, 'audio://generated/main')
  assert.equal(complete.output.artifact, base.artifact)

  for (const domain of ['audio', 'effect']) {
    const candidate = { ...base }
    delete candidate[domain]
    const result = adaptCompilerOutputToRuntimeDataV2(candidate)
    assert.equal(result.success, false)
    assert.equal('output' in result, false)
  }
  const producerFailure = adaptCompilerOutputToRuntimeDataV2({ ...base, effect: { success: false, issues: [{ source: 'effect', level: 'error', code: 'EFFECT_FAILED', message: 'failed' }] } })
  assert.equal(producerFailure.success, false)
  assert.equal('output' in producerFailure, false)
  const partial = adaptCompilerOutputToRuntimeDataV2({ ...base, audio: { success: true, value: { duration }, issues: [] } })
  assert.equal(partial.success, false)
  assert.equal('output' in partial, false)

  const adapterSources = await Promise.all([
    'src/compiler/runtimeDataV2/adaptCompilerOutputToRuntimeDataV2.ts',
    'src/compiler/runtimeDataV2/createCompilerArtifactOutput.ts',
  ].map((path) => readFile(path, 'utf8')))
  const source = adapterSources.join('\n')
  for (const forbidden of ['validateRuntimeDataV2', 'loadStaticRuntimeDataV2', 'loadGeneratedRuntimeDataV2', 'generatedRuntimeDataV2ArtifactFixture', 'createRuntimeApplicationV2']) {
    assert.equal(source.includes(forbidden), false, `forbidden dependency: ${forbidden}`)
  }
  console.log('RuntimeDataV2 Compiler Adapter verification passed')
} finally {
  await server.close()
}
