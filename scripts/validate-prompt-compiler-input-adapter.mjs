import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { adaptPromptSemanticIntent } = await server.ssrLoadModule('/src/compiler/input/index.ts')
  const duration = { value: 30, unit: 'seconds', flexibility: 'approximate' }
  const valid = {
    promptContractVersion: '1',
    intent: {
      project: { title: 'Test', purpose: 'Explain', targetDuration: duration, audience: 'Learners' },
      content: { topic: 'Adapters', message: 'Keep boundaries pure', keyPoints: ['mapping'] },
      style: { visualStyle: 'minimal', tone: 'clear', pace: 'steady', atmosphere: 'focused' },
      timeline: { pacing: 'steady', structure: 'linear', emphasis: ['boundary'] },
      scenes: [{ id: 'scene-1', purpose: 'introduce', message: 'Pure mapping', durationIntent: duration, transitionIntent: 'gentle' }],
      audio: { intent: 'voiceover', mood: 'calm', voice: 'neutral', silencePreference: 'brief pauses' },
    },
  }

  const passed = adaptPromptSemanticIntent(valid)
  assert.equal(passed.success, true)
  assert.deepEqual(Object.keys(passed.input), ['projectIntent', 'contentIntent', 'styleIntent', 'sceneIntents', 'timelineIntent', 'audioIntent'])
  assert.equal(passed.input.projectIntent, valid.intent.project)
  assert.equal(passed.input.sceneIntents, valid.intent.scenes)

  for (const [name, mutate] of [
    ['missing project', (input) => { delete input.intent.project }],
    ['missing scenes', (input) => { delete input.intent.scenes }],
    ['invalid semantic version', (input) => { input.promptContractVersion = '2' }],
    ['incomplete intent', (input) => { delete input.intent.audio.voice }],
  ]) {
    const input = structuredClone(valid)
    mutate(input)
    const result = adaptPromptSemanticIntent(input)
    assert.equal(result.success, false, name)
    assert.equal('input' in result, false, `${name} must not return partial input`)
    assert.equal(result.issues.length > 0, true, `${name} must report issues`)
  }

  const source = await readFile('src/compiler/input/adaptPromptSemanticIntent.ts', 'utf8')
  for (const forbidden of ['RuntimeDataV2', 'validateRuntimeDataV2', 'RuntimeLoader', 'audioRef', 'camera', 'effect', 'artifact']) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, `forbidden dependency: ${forbidden}`)
  }

  console.log('Prompt Compiler Input Adapter verification passed')
} finally {
  await server.close()
}
