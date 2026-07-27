import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const productionAdapterSourceFiles = Object.freeze([
  '../src/demo/productionAdapter/types.ts',
  '../src/demo/productionAdapter/createGenerationRequest.ts',
  '../src/demo/productionAdapter/createGenerationResult.ts',
  '../src/demo/productionAdapter/createMockGenerationProviderAdapter.ts',
  '../src/demo/productionAdapter/createProductionAdapterService.ts',
  '../src/demo/productionAdapter/index.ts',
])

function assertDeepFrozen(value, label) {
  if (typeof value !== 'object' || value === null) {
    return
  }

  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`)
  }
}

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

try {
  const demo = await server.ssrLoadModule('/src/demo/index.ts')
  const {
    createGenerationRequest,
    createGenerationResult,
    createMockGenerationProviderAdapter,
    createProductionAdapterService,
  } = demo

  const requestInput = {
    requestId: 'production-adapter-request-001',
    prompt: 'Create a concise product launch video.',
    style: 'cinematic technology',
    duration: 30,
    sceneCount: 5,
    qualityTier: 'PROFESSIONAL',
  }
  const requestSnapshot = structuredClone(requestInput)
  const request = createGenerationRequest(requestInput)

  assert.deepEqual(Object.keys(request), [
    'requestId',
    'prompt',
    'style',
    'duration',
    'sceneCount',
    'qualityTier',
  ])
  assert.deepEqual(request, requestSnapshot)
  assert.notEqual(request, requestInput)
  assert.deepEqual(requestInput, requestSnapshot)
  assertDeepFrozen(request, 'generationRequest')
  assert.throws(
    () =>
      createGenerationRequest({
        ...requestInput,
        sceneCount: 0,
      }),
    TypeError,
  )

  const resultInput = {
    generationId: 'generation-result-contract-001',
    status: 'COMPLETED',
    outputs: [
      {
        outputId: 'generation-output-001',
        mediaType: 'video',
        format: 'mp4',
      },
    ],
    issues: [],
  }
  const result = createGenerationResult(resultInput)
  assert.deepEqual(Object.keys(result), [
    'generationId',
    'status',
    'outputs',
    'issues',
  ])
  assert.notEqual(result, resultInput)
  assert.notEqual(result.outputs, resultInput.outputs)
  assert.notEqual(result.outputs[0], resultInput.outputs[0])
  assertDeepFrozen(result, 'generationResult')
  assert.throws(
    () =>
      createGenerationResult({
        generationId: 'invalid-completed-result',
        status: 'COMPLETED',
        outputs: [],
        issues: [],
      }),
    TypeError,
  )

  const mockProvider = createMockGenerationProviderAdapter()
  assert.equal(Object.isFrozen(mockProvider), true)
  assert.deepEqual(Object.keys(mockProvider), ['generate'])
  assert.equal(typeof mockProvider.generate, 'function')

  const mockResult = await mockProvider.generate(request)
  assert.equal(mockResult.status, 'COMPLETED')
  assert.equal(mockResult.outputs.length, 1)
  assert.equal(mockResult.outputs[0].mediaType, 'video')
  assert.equal(mockResult.outputs[0].format, 'mp4')
  assert.equal(mockResult.issues.length, 0)
  assertDeepFrozen(mockResult, 'mockResult')

  let receivedRequest
  const providerResultInput = {
    generationId: 'service-generation-001',
    status: 'COMPLETED',
    outputs: [
      {
        outputId: 'service-output-001',
        mediaType: 'video',
        format: 'webm',
      },
    ],
    issues: [],
  }
  const service = createProductionAdapterService(
    Object.freeze({
      async generate(providerRequest) {
        receivedRequest = providerRequest
        return providerResultInput
      },
    }),
  )
  assert.equal(Object.isFrozen(service), true)
  assert.deepEqual(Object.keys(service), ['generate'])

  const serviceResult = await service.generate(requestInput)
  assert.notEqual(receivedRequest, requestInput)
  assertDeepFrozen(receivedRequest, 'providerRequest')
  assert.deepEqual(requestInput, requestSnapshot)
  assert.equal(serviceResult.status, 'COMPLETED')
  assert.notEqual(serviceResult, providerResultInput)
  assert.notEqual(serviceResult.outputs, providerResultInput.outputs)
  assert.notEqual(
    serviceResult.outputs[0],
    providerResultInput.outputs[0],
  )
  assertDeepFrozen(serviceResult, 'serviceResult')

  providerResultInput.outputs[0].format = 'mutated'
  providerResultInput.outputs.push({
    outputId: 'late-output',
    mediaType: 'video',
    format: 'mp4',
  })
  assert.equal(serviceResult.outputs.length, 1)
  assert.equal(serviceResult.outputs[0].format, 'webm')

  const rejectedResult = await createProductionAdapterService(
    Object.freeze({
      async generate() {
        throw new Error('provider unavailable')
      },
    }),
  ).generate(request)
  assert.equal(rejectedResult.status, 'FAILED')
  assert.equal(rejectedResult.outputs.length, 0)
  assert.deepEqual(rejectedResult.issues, [
    {
      code: 'GENERATION_PROVIDER_FAILURE',
      message: 'provider unavailable',
    },
  ])
  assertDeepFrozen(rejectedResult, 'rejectedResult')

  const incompleteResult = await createProductionAdapterService(
    Object.freeze({
      async generate() {
        return {
          generationId: 'processing-generation',
          status: 'PROCESSING',
          outputs: [],
          issues: [],
        }
      },
    }),
  ).generate(request)
  assert.equal(incompleteResult.status, 'FAILED')
  assert.equal(incompleteResult.outputs.length, 0)
  assert.equal(
    incompleteResult.issues[0].code,
    'GENERATION_NOT_COMPLETED',
  )
  assertDeepFrozen(incompleteResult, 'incompleteResult')

  const sourceText = (
    await Promise.all(productionAdapterSourceFiles.map(readSource))
  ).join('\n')
  const importSpecifiers = [
    ...sourceText.matchAll(/from\s+['"]([^'"]+)['"]/g),
  ].map((match) => match[1])
  for (const specifier of importSpecifiers) {
    assert.equal(
      /\/(?:runtime|runtimeData|artifacts|providers)(?:\/|$)/.test(
        specifier,
      ),
      false,
      `Forbidden Production Adapter import: ${specifier}`,
    )
  }
  for (const forbiddenSymbol of [
    'ArtifactEnvelope',
    'RuntimeReference',
    'RuntimeContext',
    'RuntimeDataV2',
    "'READY'",
    '"READY"',
  ]) {
    assert.equal(
      sourceText.includes(forbiddenSymbol),
      false,
      `Forbidden Production Adapter symbol: ${forbiddenSymbol}`,
    )
  }
  for (const forbiddenOperation of [
    'fetch(',
    'node:fs',
    'writeFile',
    'createWriteStream',
  ]) {
    assert.equal(
      sourceText.includes(forbiddenOperation),
      false,
      `Forbidden Production Adapter operation: ${forbiddenOperation}`,
    )
  }

  await access(new URL('../dist/index.html', import.meta.url))

  console.log('AI Production Adapter Preparation Validation')
  console.log('1. GenerationRequest Contract: PASS')
  console.log('2. GenerationResult Contract: PASS')
  console.log('3. Provider Adapter Contract: PASS')
  console.log('4. Mock Provider: PASS')
  console.log('5. Service Flow: PASS')
  console.log('6. Immutable Output: PASS')
  console.log('7. Failure Handling: PASS')
  console.log('8. Forbidden Coupling: PASS')
  console.log('9. Runtime Isolation: PASS')
  console.log('10. Build: PASS')
} finally {
  await server.close()
}
