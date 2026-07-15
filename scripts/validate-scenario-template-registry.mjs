import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { createScenarioTemplateRegistry, validateScenarioTemplateRegistry } = await server.ssrLoadModule('/src/compiler/scenarioTemplateRegistry/index.ts')
  const template = (templateId, scenarioTemplateVersion) => ({
    identity: { templateId, scenarioTemplateVersion },
    category: 'product-promotion',
    description: 'A valid scenario template',
    applicableConditions: [],
    requiredSemanticIntent: [],
    durationConstraint: { type: 'exact', value: 30, unit: 'seconds' },
    phases: [{ id: 'intro', narrativeRole: 'introduce', order: 1, durationConstraint: { type: 'ratio', value: 1 }, presence: 'required' }],
  })
  const entry = (templateId, version) => ({ templateId, scenarioTemplateVersion: version, availability: 'available', template: template(templateId, version) })

  const single = createScenarioTemplateRegistry([entry('single', 1)])
  const singleResult = validateScenarioTemplateRegistry(single)
  assert.equal(singleResult.ok, true)
  assert.equal(singleResult.registry, single)
  assert.equal(singleResult.registry.entries[0].template, single.entries[0].template)

  const multipleResult = validateScenarioTemplateRegistry(createScenarioTemplateRegistry([entry('first', 1), entry('second', '1')]))
  assert.equal(multipleResult.ok, true)

  const duplicateResult = validateScenarioTemplateRegistry(createScenarioTemplateRegistry([entry('duplicate', 1), entry('duplicate', 1)]))
  assert.equal(duplicateResult.ok, false)
  assert.deepEqual(duplicateResult.issues.map(({ code }) => code), ['DUPLICATE_IDENTITY'])
  assert.equal('registry' in duplicateResult, false)

  const mismatch = entry('entry-id', 1)
  const mismatchResult = validateScenarioTemplateRegistry(createScenarioTemplateRegistry([{ ...mismatch, template: template('template-id', 1) }]))
  assert.equal(mismatchResult.ok, false)
  assert.deepEqual(mismatchResult.issues.map(({ code }) => code), ['IDENTITY_MISMATCH'])
  assert.equal('registry' in mismatchResult, false)

  console.log('Scenario Template Registry verification passed')
} finally {
  await server.close()
}
