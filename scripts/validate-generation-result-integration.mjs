import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const execution = await server.ssrLoadModule('/src/execution/index.ts')
  const executionAdapters = await server.ssrLoadModule(
    '/src/execution/adapters/index.ts',
  )
  const providers = await server.ssrLoadModule('/src/providers/index.ts')
  const production = await server.ssrLoadModule('/src/production/index.ts')

  assert.deepEqual(Object.keys(execution), ['createExecutionManager'])
  assert.equal('createGenerationPipeline' in execution, false)

  const generationResult = Object.freeze({
    taskId: 'task-1',
    providerId: 'mock-video',
    providerTaskId: 'provider-task-1',
    status: 'SUCCEEDED',
    output: Object.freeze({
      mediaType: 'video',
      format: 'mp4',
      reference: 'provider://outputs/video-1',
    }),
    issues: Object.freeze([]),
  })

  const adaptation =
    executionAdapters.adaptGenerationResultToOutput(generationResult)
  assert.equal(adaptation.ok, true)
  assert.equal(
    adaptation.output.generationResultId,
    `generation-result:${generationResult.providerId}:${generationResult.providerTaskId}`,
  )
  assert.equal(adaptation.output.providerId, generationResult.providerId)
  assert.equal(
    adaptation.output.outputReference,
    generationResult.output.reference,
  )
  assert.equal(
    adaptation.output.metadata.providerTaskId,
    generationResult.providerTaskId,
  )
  assert.equal(adaptation.output.metadata.taskId, generationResult.taskId)
  assert.equal(Object.isFrozen(adaptation.output), true)
  assert.equal(Object.isFrozen(adaptation.output.metadata), true)

  const invalidAdaptation = executionAdapters.adaptGenerationResultToOutput({
    ...generationResult,
    output: { ...generationResult.output, providerNativeResponse: {} },
  })
  assert.equal(invalidAdaptation.ok, false)
  assert.equal(
    invalidAdaptation.issues[0].code,
    'INVALID_GENERATION_RESULT',
  )

  const nonSuccessfulAdaptation =
    executionAdapters.adaptGenerationResultToOutput({
      ...generationResult,
      status: 'FAILED',
      providerTaskId: null,
      output: null,
      issues: [{ code: 'FAILED', message: 'Generation failed' }],
    })
  assert.equal(nonSuccessfulAdaptation.ok, false)
  assert.equal(
    nonSuccessfulAdaptation.issues[0].code,
    'GENERATION_RESULT_NOT_SUCCEEDED',
  )

  const registry = providers.createProviderRegistry([
    providers.createMockProviderAdapter(),
  ])
  const executionManager = execution.createExecutionManager(registry)
  const executionResult = await executionManager.execute({
    planId: 'plan-1',
    requestId: 'request-1',
    tasks: [
      {
        taskId: 'task-1',
        requestId: 'request-1',
        providerId: providers.MOCK_PROVIDER_METADATA.id,
        generationIntent: 'Generate one test video',
        outputSpecification: {
          mediaType: 'video',
          format: 'mp4',
        },
      },
    ],
  })

  assert.equal(executionResult.executionId, 'execution:plan-1')
  assert.equal(production.isGenerationResult(executionResult.results[0]), true)
  assert.equal(executionResult.status, 'COMPLETED')
  assert.equal(executionResult.generationOutputs.length, 1)
  assert.equal(
    executionResult.generationOutputs[0].providerId,
    executionResult.results[0].providerId,
  )
  assert.equal(
    executionResult.generationOutputs[0].outputReference,
    executionResult.results[0].output.reference,
  )

  const executionIndexSource = await readFile(
    new URL('../src/execution/index.ts', import.meta.url),
    'utf8',
  )
  assert.match(executionIndexSource, /export \{ createExecutionManager \}/)
  assert.doesNotMatch(executionIndexSource, /createGenerationPipeline/)
  assert.doesNotMatch(executionIndexSource, /GenerationPipeline/)

  const executionManagerSource = await readFile(
    new URL('../src/execution/createExecutionManager.ts', import.meta.url),
    'utf8',
  )
  assert.match(executionManagerSource, /createGenerationPipeline/)
  assert.match(executionManagerSource, /pipeline\.execute\(/)

  const boundarySource = await readFile(
    new URL(
      '../src/artifacts/contracts/artifactCreationBoundary.ts',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(boundarySource, /interface ArtifactCreationBoundary/)
  assert.match(boundarySource, /createArtifactCandidate\(/)
  assert.doesNotMatch(boundarySource, /class |function |=>/)

  const pipelineSource = await readFile(
    new URL(
      '../src/execution/pipeline/createGenerationPipeline.ts',
      import.meta.url,
    ),
    'utf8',
  )
  assert.doesNotMatch(pipelineSource, /createArtifactCandidate/)

  console.log('Execution authority and generation result validation passed')
  console.log('publicExecutionApi = PASS')
  console.log('executionManagerFlow = PASS')
  console.log('pipelineInternal = PASS')
  console.log('publicPipelineBypass = ABSENT')
  console.log('generationResultIntegration = PASS')
} finally {
  await server.close()
}
