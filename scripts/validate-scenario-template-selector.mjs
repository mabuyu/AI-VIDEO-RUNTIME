import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { selectScenarioTemplate } = await server.ssrLoadModule('/src/compiler/scenarioTemplateSelector/index.ts')
  const semanticIntent = {
    projectIntent: { title: 'Product', purpose: 'product-promotion', targetDuration: { value: 30, unit: 'seconds', flexibility: 'exact' }, audience: 'buyers' },
    contentIntent: { topic: 'Product', message: 'Value', keyPoints: ['Fast'] },
    styleIntent: { visualStyle: 'clean', tone: 'confident', pace: 'steady', atmosphere: 'bright' },
    sceneIntents: [],
    timelineIntent: { pacing: 'steady', structure: 'intro-feature-outro', emphasis: [] },
    audioIntent: { intent: 'voiceover', mood: 'bright', voice: 'neutral', silencePreference: 'none' },
  }
  const template = (templateId, purpose = 'product-promotion') => ({
    identity: { templateId, scenarioTemplateVersion: 1 },
    category: 'product-promotion',
    description: 'A deterministic template',
    applicableConditions: [{ semanticPath: 'projectIntent.purpose', expectation: purpose }],
    requiredSemanticIntent: [{ semanticPath: 'contentIntent.message', requirement: 'required' }],
    durationConstraint: { type: 'exact', value: 30, unit: 'seconds' },
    phases: [{ id: 'intro', narrativeRole: 'introduce', order: 1, durationConstraint: { type: 'ratio', value: 1 }, presence: 'required' }],
  })
  const entry = (templateId, purpose) => ({ templateId, scenarioTemplateVersion: 1, availability: 'available', template: template(templateId, purpose) })

  const matching = entry('product-30', 'product-promotion')
  const nonMatching = entry('education-30', 'education')
  const exact = selectScenarioTemplate({ registry: { entries: [matching, nonMatching] }, semanticIntent })
  assert.equal(exact.ok, true)
  assert.equal(exact.selected.templateId, 'product-30')
  assert.equal(exact.selected.template, matching.template)
  assert.deepEqual(Object.keys(exact.selected).sort(), ['metadata', 'scenarioTemplateVersion', 'template', 'templateId'])

  const reordered = selectScenarioTemplate({ registry: { entries: [nonMatching, matching] }, semanticIntent })
  assert.deepEqual(reordered, exact)

  const noMatch = selectScenarioTemplate({ registry: { entries: [nonMatching] }, semanticIntent })
  assert.equal(noMatch.ok, false)
  assert.deepEqual(noMatch.issues.map(({ code }) => code), ['NO_MATCH'])
  assert.equal('selected' in noMatch, false)

  const multiple = selectScenarioTemplate({ registry: { entries: [entry('match-b', 'product-promotion'), entry('match-a', 'product-promotion')] }, semanticIntent })
  assert.equal(multiple.ok, false)
  assert.deepEqual(multiple.issues.map(({ templateId }) => templateId), ['match-a', 'match-b'])
  assert.equal('selected' in multiple, false)

  const invalid = selectScenarioTemplate({ registry: { entries: [matching, matching] }, semanticIntent })
  assert.equal(invalid.ok, false)
  assert.deepEqual(invalid.issues.map(({ code }) => code), ['INVALID_REGISTRY'])
  assert.equal('selected' in invalid, false)

  console.log('Scenario Template Selector verification passed')
} finally {
  await server.close()
}
