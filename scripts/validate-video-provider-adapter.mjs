import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { SeedanceProvider } = await server.ssrLoadModule('/src/providers/video/index.ts')
  let providerRequest
  const taskResults = new Map([
    ['task-queued', { taskId: 'task-queued', status: 'queued', metadata: { providerTaskId: 'task-queued' } }],
    ['task-processing', { taskId: 'task-processing', status: 'running', metadata: { providerTaskId: 'task-processing' } }],
    ['task-succeeded', { taskId: 'task-succeeded', status: 'succeeded', videoUrl: 'https://video.example/result.mp4', metadata: { providerTaskId: 'task-succeeded' } }],
    ['task-failed', { taskId: 'task-failed', status: 'failed', metadata: { providerTaskId: 'task-failed' }, error: { code: 'MODEL_FAILED', message: 'Generation failed' } }],
  ])
  const provider = new SeedanceProvider(
    { credentials: { apiKey: 'test-only' }, model: 'seedance-test' },
    { createTask: async (request) => {
      providerRequest = request
      return { taskId: 'task-1', status: 'queued', metadata: { providerTaskId: 'task-1' } }
    }, getTask: async (generationId) => {
      const task = taskResults.get(generationId)
      if (!task) throw new Error('Task not found')
      return task
    } },
  )
  const result = await provider.generateVideo({
    generationRequestId: 'request-1',
    prompt: 'Show a product in motion',
    sceneDescription: 'A clean studio product shot',
    cameraPlan: { description: 'Slow push in', movements: [{ startSeconds: 0, endSeconds: 5, movement: 'push-in' }] },
    timeline: { segments: [{ startSeconds: 0, endSeconds: 5, description: 'Product reveal' }] },
    durationSeconds: 5,
    aspectRatio: '16:9',
    style: { description: 'cinematic', tags: ['clean'] },
    metadata: { correlationId: 'smoke' },
  })

  assert.equal(provider.providerId, 'seedance')
  assert.equal(providerRequest.model, 'seedance-test')
  assert.equal(providerRequest.duration, 5)
  assert.equal(providerRequest.ratio, '16:9')
  assert.match(providerRequest.content[0].text, /Product reveal/)
  assert.deepEqual(result, {
    generationId: 'task-1',
    status: 'QUEUED',
    videoReference: null,
    providerMetadata: { providerTaskId: 'task-1' },
    issues: [],
  })

  const queued = await provider.getGenerationStatus('task-queued')
  const processing = await provider.getGenerationStatus('task-processing')
  const succeeded = await provider.getGenerationStatus('task-succeeded')
  const failed = await provider.getGenerationStatus('task-failed')
  assert.equal(queued.status, 'QUEUED')
  assert.equal(queued.videoReference, null)
  assert.equal(processing.status, 'PROCESSING')
  assert.equal(processing.videoReference, null)
  assert.deepEqual(succeeded.videoReference, { referenceType: 'provider-video', reference: 'https://video.example/result.mp4' })
  assert.equal(succeeded.status, 'SUCCEEDED')
  assert.equal(failed.status, 'FAILED')
  assert.equal(failed.videoReference, null)
  assert.deepEqual(failed.issues, [{ code: 'PROVIDER_GENERATION_FAILED', message: 'Seedance generation failed', retryable: undefined }])

  const queryFailure = await provider.getGenerationStatus('missing-task')
  assert.equal(queryFailure.status, 'FAILED')
  assert.equal(queryFailure.issues[0].code, 'PROVIDER_STATUS_QUERY_FAILED')
  console.log('Video Provider Adapter create/status smoke verification passed')
} finally {
  await server.close()
}
