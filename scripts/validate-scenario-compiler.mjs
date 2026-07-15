import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { compileScenario } = await server.ssrLoadModule('/src/compiler/scenarioCompiler/index.ts')
  const generationId = 'generation-b8-2'
  const input = {
    selectedScenarioTemplate: { templateId: 'product-30', scenarioTemplateVersion: 1, template: {}, metadata: {} },
    compilerInputCandidate: { semantic: 'candidate' },
    planningContext: {
      generationId,
      compilerVersion: 1,
      promptContractVersion: 1,
      scenarioTemplateVersion: 1,
    },
  }
  const outputs = {
    scene: { project: { id: 'project' }, scenes: [{ id: 'scene' }], subtitles: [] },
    timeline: { timeline: { duration: 1000 } },
    camera: { tracks: [{ id: 'camera' }] },
    effect: { tracks: [{ id: 'effect' }] },
    depth: { tracks: [{ id: 'depth' }] },
    composition: { tracks: [{ id: 'composition' }] },
    audio: { duration: 1000, tracks: [{ id: 'silence' }] },
  }
  const dependencyKeys = {
    scene: [],
    timeline: ['scene'],
    camera: ['scene', 'timeline'],
    effect: ['scene', 'timeline'],
    composition: ['camera', 'scene', 'timeline'],
    depth: ['camera', 'composition', 'scene', 'timeline'],
    audio: ['scene', 'timeline'],
  }

  function producers(overrides = {}, expectedInput = input) {
    const calls = []
    const producedGenerationIds = []
    const ports = {}
    for (const domain of ['scene', 'timeline', 'camera', 'effect', 'composition', 'depth', 'audio']) {
      ports[domain] = {
        produce(producerInput) {
          calls.push(domain)
          assert.equal(producerInput.selectedScenarioTemplate, expectedInput.selectedScenarioTemplate)
          assert.equal(producerInput.compilerInputCandidate, expectedInput.compilerInputCandidate)
          assert.equal(producerInput.planningContext, expectedInput.planningContext)
          const actualDependencies = Object.keys(producerInput)
            .filter((key) => !['selectedScenarioTemplate', 'compilerInputCandidate', 'planningContext'].includes(key))
            .sort()
          assert.deepEqual(actualDependencies, dependencyKeys[domain])
          const result = overrides[domain] ?? { success: true, generationId, output: outputs[domain] }
          if (result.success) producedGenerationIds.push(result.generationId)
          return result
        },
      }
    }
    return { ports, calls, producedGenerationIds }
  }

  const successful = producers()
  const success = compileScenario(input, successful.ports)
  assert.equal(success.success, true)
  assert.deepEqual(successful.calls, ['scene', 'timeline', 'camera', 'effect', 'composition', 'depth', 'audio'])
  assert.deepEqual(Object.keys(success.output), ['scene', 'timeline', 'camera', 'effect', 'depth', 'composition', 'audio'])
  for (const domain of Object.keys(outputs)) assert.equal(success.output[domain], outputs[domain])

  assert.equal(successful.producedGenerationIds.length, 7)
  assert.deepEqual([...new Set(successful.producedGenerationIds)], [generationId])

  const deterministic = producers()
  const repeated = compileScenario(input, deterministic.ports)
  assert.deepEqual(repeated, success)
  assert.deepEqual(deterministic.calls, successful.calls)

  const failed = producers({
    effect: {
      success: false,
      issues: [{ code: 'EFFECT_FAILED', message: 'Effect generation failed', path: 'tracks' }],
    },
  })
  const failure = compileScenario(input, failed.ports)
  assert.equal(failure.success, false)
  assert.equal('output' in failure, false)
  assert.deepEqual(failed.calls, ['scene', 'timeline', 'camera', 'effect'])
  assert.deepEqual(failure.issues, [{
    code: 'PRODUCER_GENERATION_FAILED',
    message: 'Effect generation failed',
    domain: 'effect',
    path: 'tracks',
    producerIssueCode: 'EFFECT_FAILED',
  }])
  for (const domain of Object.keys(outputs)) assert.equal(JSON.stringify(failure).includes(JSON.stringify(outputs[domain])), false)

  const mismatched = producers({
    camera: { success: true, generationId: 'previous-run', output: outputs.camera },
  })
  const generationFailure = compileScenario(input, mismatched.ports)
  assert.equal(generationFailure.success, false)
  assert.equal('output' in generationFailure, false)
  assert.deepEqual(mismatched.calls, ['scene', 'timeline', 'camera'])
  assert.deepEqual(generationFailure.issues, [{
    code: 'INCOMPATIBLE_PLANNING_CONTEXT',
    message: 'camera producer received "previous-run"; expected "generation-b8-2"',
    domain: 'camera',
    path: 'generationId',
  }])

  const missingGenerationId = producers({
    scene: { success: true, output: outputs.scene },
  })
  const missingGenerationFailure = compileScenario(input, missingGenerationId.ports)
  assert.equal(missingGenerationFailure.success, false)
  assert.equal('output' in missingGenerationFailure, false)
  assert.deepEqual(missingGenerationId.calls, ['scene'])
  assert.deepEqual(missingGenerationFailure.issues, [{
    code: 'INCOMPATIBLE_PLANNING_CONTEXT',
    message: 'scene producer received no generationId; expected "generation-b8-2"',
    domain: 'scene',
    path: 'generationId',
  }])

  const changedPlanningContextInput = {
    ...input,
    planningContext: { ...input.planningContext, generationId: 'planning-context-run' },
  }
  const planningContextMismatch = producers({}, changedPlanningContextInput)
  const planningContextFailure = compileScenario(changedPlanningContextInput, planningContextMismatch.ports)
  assert.equal(planningContextFailure.success, false)
  assert.equal('output' in planningContextFailure, false)
  assert.deepEqual(planningContextMismatch.calls, ['scene'])

  console.log('Scenario Compiler verification passed')
} finally {
  await server.close()
}
