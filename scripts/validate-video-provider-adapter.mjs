import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { SeedanceProvider } = await server.ssrLoadModule('/src/providers/video/index.ts')
  let providerRequest
  const provider = new SeedanceProvider(
    { credentials: { apiKey: 'test-only' }, model: 'seedance-test' },
    { createTask: async (request) => {
      providerRequest = request
      return { taskId: 'task-1', status: 'queued', metadata: { providerTaskId: 'task-1' } }
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
  console.log('Video Provider Adapter smoke verification passed')
} finally {
  await server.close()
}
