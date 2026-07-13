import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { packageCompilerArtifactOutput } = await server.ssrLoadModule('/src/compiler/artifact/index.ts')
  const runtimeData = { opaque: 'packaging-boundary-does-not-inspect-runtime-data' }
  const artifact = { id: 'artifact-1', revision: '1', createdAt: '2026-07-13T00:00:00.000Z' }
  const compatibility = { schemaVersion: '1', runtimeSchemaVersion: '2' }
  const generation = { compilerVersion: '2.0.0', promptContractVersion: '1', generatedAt: '2026-07-13T00:00:00.000Z' }
  const input = { artifact, compatibility, generation, runtimeData, diagnostics: [{ level: 'warning', code: 'NOTE', message: 'compiler only' }] }

  const packaged = packageCompilerArtifactOutput(input)
  assert.equal(packaged.success, true)
  assert.deepEqual(Object.keys(packaged.envelope), ['artifact', 'schemaVersion', 'runtimeSchemaVersion', 'generation', 'runtimeData'])
  assert.equal(packaged.envelope.artifact, artifact)
  assert.equal(packaged.envelope.generation, generation)
  assert.equal(packaged.envelope.runtimeData, runtimeData)
  assert.equal('compatibility' in packaged.envelope, false)
  assert.equal('diagnostics' in packaged.envelope, false)

  for (const field of ['artifact', 'compatibility', 'runtimeData']) {
    const invalid = { ...input }
    delete invalid[field]
    const result = packageCompilerArtifactOutput(invalid)
    assert.equal(result.success, false, `missing ${field} must fail`)
    assert.equal('envelope' in result, false)
  }

  for (const invalidMetadata of [
    { ...input, artifact: { ...artifact, id: '' } },
    { ...input, compatibility: { ...compatibility, schemaVersion: Number.NaN } },
    { ...input, generation: { ...generation, generatedAt: 'not-a-timestamp' } },
  ]) {
    const result = packageCompilerArtifactOutput(invalidMetadata)
    assert.equal(result.success, false)
    assert.equal('envelope' in result, false)
    assert.equal(result.issues.some(({ code }) => code === 'INVALID_METADATA'), true)
  }

  const packagingSources = await Promise.all([
    'src/compiler/artifact/packageCompilerArtifactOutput.ts',
    'src/compiler/artifact/types.ts',
    'src/compiler/artifact/index.ts',
  ].map((path) => readFile(path, 'utf8')))
  const source = packagingSources.join('\n')
  for (const forbidden of [
    'validateRuntimeDataV2',
    'loadGeneratedRuntimeDataV2',
    'loadStaticRuntimeDataV2',
    'generatedRuntimeDataV2ArtifactFixture',
    'createRuntimeApplicationV2',
    'RuntimeContext',
    'RuntimeDataSource',
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden dependency: ${forbidden}`)
  }

  console.log('Compiler Artifact Packaging Boundary verification passed')
} finally {
  await server.close()
}
