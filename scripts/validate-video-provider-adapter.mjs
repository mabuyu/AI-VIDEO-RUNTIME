import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { readdir, stat } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const {
    KlingProvider,
    SeedanceProvider,
    consumeVideoReference,
    generateVideoAndWait,
    resolveKlingProviderConfig,
    resolveSeedanceProviderConfig,
  } = await server.ssrLoadModule('/src/providers/video/index.ts')
  let providerRequest
  const taskResults = new Map([
    ['task-queued', { taskId: 'task-queued', status: 'queued', metadata: { providerTaskId: 'task-queued' } }],
    ['task-processing', { taskId: 'task-processing', status: 'processing', metadata: { providerTaskId: 'task-processing' } }],
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
  assert.match(providerRequest.prompt, /Product reveal/)
  assert.match(providerRequest.prompt, /Output: 5 seconds; aspect ratio 16:9$/)
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
  assert.deepEqual(failed.issues, [{ code: 'PROVIDER_GENERATION_FAILED', message: 'Seedance generation failed' }])

  const queryFailure = await provider.getGenerationStatus('missing-task')
  assert.equal(queryFailure.status, 'FAILED')
  assert.equal(queryFailure.issues[0].code, 'PROVIDER_STATUS_QUERY_FAILED')

  const request = {
    generationRequestId: 'flow-request',
    prompt: 'Generate a complete video',
    sceneDescription: 'A complete flow smoke test',
    cameraPlan: { description: 'Static', movements: [] },
    timeline: { segments: [{ startSeconds: 0, endSeconds: 1, description: 'Smoke test' }] },
    durationSeconds: 1,
    aspectRatio: '16:9',
    style: { description: 'test', tags: [] },
    metadata: {},
  }

  assert.deepEqual(resolveSeedanceProviderConfig({ SEEDANCE_API_KEY: 'test-only' }), {
    credentials: { apiKey: 'test-only' },
    model: 'doubao-seedance-2.0-mini',
    baseUrl: 'https://infistar.ai',
  })
  assert.deepEqual(resolveSeedanceProviderConfig({
    SEEDANCE_API_KEY: 'test-only',
    SEEDANCE_MODEL: '  environment-selected-seedance  ',
    SEEDANCE_BASE_URL: '  https://seedance.example/  ',
  }), {
    credentials: { apiKey: 'test-only' },
    model: 'environment-selected-seedance',
    baseUrl: 'https://seedance.example/',
  })
  assert.throws(() => resolveSeedanceProviderConfig({}), /SEEDANCE_API_KEY is required/)

  let realProtocolRequestBody
  let realProtocolContentType
  let realProtocolAuthorization
  let realProtocolCreateCount = 0
  const realProtocolServer = createHttpServer((request, response) => {
    if (request.method === 'POST' && request.url === '/v1/videos') {
      const chunks = []
      request.on('data', (chunk) => chunks.push(chunk))
      request.on('end', () => {
        realProtocolCreateCount += 1
        realProtocolRequestBody = Buffer.concat(chunks).toString('utf8')
        realProtocolContentType = request.headers['content-type']
        realProtocolAuthorization = request.headers.authorization
        if (realProtocolRequestBody.includes('seedance-http-error-test')) {
          response.writeHead(401, { 'content-type': 'application/json' })
          response.end(JSON.stringify({
            error: {
              code: 'AuthenticationError',
              message: 'Invalid API credential',
              api_key: 'must-not-print',
            },
          }))
          return
        }
        if (realProtocolRequestBody.includes('seedance-missing-id-test')) {
          response.writeHead(200, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ status: 'queued' }))
          return
        }
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(realProtocolCreateCount === 1
          ? JSON.stringify({ id: 'real-protocol-task' })
          : JSON.stringify({ task_id: 'real-protocol-task-alias' }))
      })
      return
    }
    if (request.method === 'GET' && request.url?.startsWith('/v1/video/generations/')) {
      const taskId = decodeURIComponent(request.url.slice('/v1/video/generations/'.length))
      const tasks = {
        'real-protocol-task': { id: 'real-protocol-task', status: 'success', content: { video_url: 'https://video.example/real-protocol.mp4' } },
        'seedance-pending': { task_id: 'seedance-pending', status: 'pending' },
        'seedance-running': { id: 'seedance-running', status: 'running' },
        'seedance-top-level-video': { task_id: 'seedance-top-level-video', status: 'completed', video_url: 'https://video.example/top-level.mp4' },
        'seedance-failed': { id: 'seedance-failed', status: 'error' },
        'seedance-missing-video': { id: 'seedance-missing-video', status: 'succeeded' },
        'seedance-missing-id': { status: 'processing' },
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(tasks[taskId] ?? { unexpected: true }))
      return
    }
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { message: 'Not found' } }))
  })
  await new Promise((resolve) => realProtocolServer.listen(0, '127.0.0.1', resolve))
  try {
    const address = realProtocolServer.address()
    assert(address && typeof address === 'object')
    const realProtocolProvider = new SeedanceProvider({
      credentials: { apiKey: 'test-only' },
      model: 'seedance-real-protocol-test',
      baseUrl: `http://127.0.0.1:${address.port}`,
    })
    const createdFromRealProtocol = await realProtocolProvider.generateVideo(request)
    assert.equal(createdFromRealProtocol.generationId, 'real-protocol-task')
    assert.equal(createdFromRealProtocol.status, 'QUEUED')
    assert.equal(realProtocolAuthorization, 'Bearer test-only')
    assert.match(realProtocolContentType, /^multipart\/form-data; boundary=/)
    assert.match(realProtocolRequestBody, /name="model"[\s\S]*seedance-real-protocol-test/)
    assert.match(realProtocolRequestBody, /name="prompt"[\s\S]*Smoke test/)
    assert.match(realProtocolRequestBody, /Output: 1 seconds; aspect ratio 16:9/)

    const createdFromTaskId = await realProtocolProvider.generateVideo(request)
    assert.equal(createdFromTaskId.generationId, 'real-protocol-task-alias')
    assert.equal(createdFromTaskId.status, 'QUEUED')

    const succeededFromRealProtocol = await realProtocolProvider.getGenerationStatus('real-protocol-task')
    assert.equal(succeededFromRealProtocol.status, 'SUCCEEDED')
    assert.deepEqual(succeededFromRealProtocol.videoReference, {
      referenceType: 'provider-video',
      reference: 'https://video.example/real-protocol.mp4',
    })

    const pendingFromRealProtocol = await realProtocolProvider.getGenerationStatus('seedance-pending')
    const runningFromRealProtocol = await realProtocolProvider.getGenerationStatus('seedance-running')
    const topLevelVideo = await realProtocolProvider.getGenerationStatus('seedance-top-level-video')
    const failedFromRealProtocol = await realProtocolProvider.getGenerationStatus('seedance-failed')
    const missingVideo = await realProtocolProvider.getGenerationStatus('seedance-missing-video')
    const missingId = await realProtocolProvider.getGenerationStatus('seedance-missing-id')
    assert.equal(pendingFromRealProtocol.status, 'QUEUED')
    assert.equal(runningFromRealProtocol.status, 'PROCESSING')
    assert.equal(topLevelVideo.status, 'SUCCEEDED')
    assert.deepEqual(topLevelVideo.videoReference, { referenceType: 'provider-video', reference: 'https://video.example/top-level.mp4' })
    assert.equal(failedFromRealProtocol.status, 'FAILED')
    assert.equal(failedFromRealProtocol.issues[0].code, 'PROVIDER_GENERATION_FAILED')
    assert.equal(missingVideo.status, 'FAILED')
    assert.equal(missingVideo.issues[0].code, 'INVALID_PROVIDER_RESPONSE')
    assert.equal(missingId.status, 'FAILED')
    assert.equal(missingId.issues[0].code, 'PROVIDER_STATUS_QUERY_FAILED')

    const debugCalls = []
    const originalConsoleError = console.error
    console.error = (...values) => debugCalls.push(values)
    try {
      const missingIdentityProvider = new SeedanceProvider({
        credentials: { apiKey: 'test-only-secret' },
        model: 'seedance-missing-id-test',
        baseUrl: `http://127.0.0.1:${address.port}`,
      })
      const missingIdentity = await missingIdentityProvider.generateVideo(request)
      assert.equal(missingIdentity.status, 'FAILED')
      assert.equal(missingIdentity.videoReference, null)
      assert.equal(missingIdentity.issues[0].code, 'PROVIDER_CALL_FAILED')

      const rejectedProvider = new SeedanceProvider({
        credentials: { apiKey: 'test-only-secret' },
        model: 'seedance-http-error-test',
        baseUrl: `http://127.0.0.1:${address.port}`,
      })
      const rejected = await rejectedProvider.generateVideo(request)
      assert.equal(rejected.status, 'FAILED')
      assert.equal(rejected.videoReference, null)
      assert.deepEqual(rejected.issues, [{ code: 'PROVIDER_CALL_FAILED', message: 'Seedance provider call failed' }])
    } finally {
      console.error = originalConsoleError
    }
    assert.equal(debugCalls.length, 2)
    assert(debugCalls.every((call) => call.length === 1))
    for (const [diagnostic] of debugCalls) {
      assert.deepEqual(Object.keys(diagnostic).sort(), ['httpStatus', 'operation', 'response'])
    }
    const diagnosticText = JSON.stringify(debugCalls)
    assert.match(diagnosticText, /"operation":"create"/)
    assert.match(diagnosticText, /"httpStatus":200/)
    assert.match(diagnosticText, /"httpStatus":401/)
    assert.match(diagnosticText, /"response":/)
    assert.match(diagnosticText, /api_key/)
    assert.match(diagnosticText, /\[REDACTED\]/)
    assert.doesNotMatch(diagnosticText, /test-only-secret|must-not-print|Authorization|Bearer|token|secret/)
  } finally {
    await new Promise((resolve, reject) => realProtocolServer.close((error) => error ? reject(error) : resolve()))
  }

  assert.deepEqual(resolveKlingProviderConfig({ KLING_API_KEY: 'test-only' }), {
    credentials: { apiKey: 'test-only' },
    model: 'kling-v2-5-turbo',
    baseUrl: 'https://infistar.ai',
  })
  assert.deepEqual(resolveKlingProviderConfig({
    KLING_API_KEY: 'test-only',
    KLING_MODEL: '  environment-selected-model  ',
  }), {
    credentials: { apiKey: 'test-only' },
    model: 'environment-selected-model',
    baseUrl: 'https://infistar.ai',
  })
  assert.throws(() => resolveKlingProviderConfig({}), /KLING_API_KEY is required/)

  let klingCreateRequest
  let klingCreateAuthorization
  let klingCreateCallCount = 0
  const klingQueryAuthorizations = []
  const klingQueryUrls = []
  const klingProtocolServer = createHttpServer((request, response) => {
    if (request.method === 'POST' && request.url === '/kling/v1/videos/text2video') {
      const chunks = []
      request.on('data', (chunk) => chunks.push(chunk))
      request.on('end', () => {
        klingCreateCallCount += 1
        klingCreateAuthorization = request.headers.authorization
        klingCreateRequest = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(klingCreateCallCount === 1
          ? JSON.stringify({ id: 'kling-task' })
          : JSON.stringify({ data: { task_id: 'kling-task-alias' } }))
      })
      return
    }

    if (request.method === 'GET' && request.url?.startsWith('/v1/video/generations/')) {
      const taskId = decodeURIComponent(request.url.slice('/v1/video/generations/'.length))
      klingQueryAuthorizations.push(request.headers.authorization)
      klingQueryUrls.push(request.url)
      const tasks = {
        'kling-task': { task_id: 'kling-task', status: 'success', video_url: 'https://video.example/kling.mp4' },
        'kling-submitted': { task_id: 'kling-submitted', status: 'waiting' },
        'kling-processing': { task_id: 'kling-processing', task_status: 'processing' },
        'kling-failed': { task_id: 'kling-failed', status: 'failed', error: { message: 'raw provider failure', api_key: 'must-not-leak' } },
        'kling-missing-video': { task_id: 'kling-missing-video', status: 'completed' },
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(taskId === 'kling-invalid'
        ? JSON.stringify({ data: { unexpected: true } })
        : JSON.stringify({ data: tasks[taskId] }))
      return
    }

    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ message: 'Not found' }))
  })
  await new Promise((resolve) => klingProtocolServer.listen(0, '127.0.0.1', resolve))
  try {
    const address = klingProtocolServer.address()
    assert(address && typeof address === 'object')
    const klingProvider = new KlingProvider(resolveKlingProviderConfig({
      KLING_API_KEY: 'kling-test-only-secret',
      KLING_MODEL: 'kling-v2-5-turbo',
      KLING_BASE_URL: `http://127.0.0.1:${address.port}`,
    }))

    const created = await klingProvider.generateVideo(request)
    assert.equal(klingProvider.providerId, 'kling')
    assert.equal(klingCreateAuthorization, 'Bearer kling-test-only-secret')
    assert.deepEqual(Object.keys(klingCreateRequest).sort(), ['model', 'prompt'])
    assert.equal(klingCreateRequest.model, 'kling-v2-5-turbo')
    assert.match(klingCreateRequest.prompt, /Smoke test/)
    assert.match(klingCreateRequest.prompt, /Output: 1 seconds; aspect ratio 16:9/)
    assert.deepEqual(created, {
      generationId: 'kling-task',
      status: 'QUEUED',
      videoReference: null,
      providerMetadata: { providerTaskId: 'kling-task' },
      issues: [],
    })

    const createdFromTaskId = await klingProvider.generateVideo(request)
    assert.equal(createdFromTaskId.generationId, 'kling-task-alias')
    assert.equal(createdFromTaskId.status, 'QUEUED')

    const submitted = await klingProvider.getGenerationStatus('kling-submitted')
    const processing = await klingProvider.getGenerationStatus('kling-processing')
    const succeeded = await klingProvider.getGenerationStatus('kling-task')
    const failed = await klingProvider.getGenerationStatus('kling-failed')
    const invalid = await klingProvider.getGenerationStatus('kling-invalid')
    const missingVideo = await klingProvider.getGenerationStatus('kling-missing-video')

    assert.equal(submitted.status, 'QUEUED')
    assert.equal(processing.status, 'PROCESSING')
    assert.equal(succeeded.status, 'SUCCEEDED')
    assert.deepEqual(succeeded.videoReference, {
      referenceType: 'provider-video',
      reference: 'https://video.example/kling.mp4',
    })
    assert.equal(failed.status, 'FAILED')
    assert.equal(failed.issues[0].code, 'PROVIDER_GENERATION_FAILED')
    assert.equal(invalid.status, 'FAILED')
    assert.equal(invalid.issues[0].code, 'PROVIDER_STATUS_QUERY_FAILED')
    assert.equal(missingVideo.status, 'FAILED')
    assert.equal(missingVideo.issues[0].code, 'INVALID_PROVIDER_RESPONSE')
    assert(klingQueryUrls.includes('/v1/video/generations/kling-task'))
    assert(klingQueryAuthorizations.every((value) => value === 'Bearer kling-test-only-secret'))

    const publicResults = JSON.stringify([created, createdFromTaskId, submitted, processing, succeeded, failed, invalid, missingVideo])
    assert.doesNotMatch(publicResults, /kling-test-only-secret|must-not-leak|raw provider failure|Authorization|Bearer/)
  } finally {
    await new Promise((resolve, reject) => klingProtocolServer.close((error) => error ? reject(error) : resolve()))
  }

  const observedStatuses = []
  const flowResults = [
    { generationId: 'flow-task', status: 'QUEUED', videoReference: null, providerMetadata: {}, issues: [] },
    { generationId: 'flow-task', status: 'PROCESSING', videoReference: null, providerMetadata: {}, issues: [] },
    { generationId: 'flow-task', status: 'SUCCEEDED', videoReference: { referenceType: 'provider-video', reference: 'https://video.example/flow.mp4' }, providerMetadata: {}, issues: [] },
  ]
  let createCalls = 0
  let statusCalls = 0
  const flowProvider = {
    providerId: 'flow-smoke',
    async generateVideo() {
      createCalls += 1
      return flowResults[0]
    },
    async getGenerationStatus(generationId) {
      assert.equal(generationId, 'flow-task')
      statusCalls += 1
      const next = flowResults[statusCalls] ?? flowResults.at(-1)
      observedStatuses.push(next.status)
      return next
    },
  }
  const flowSucceeded = await generateVideoAndWait(flowProvider, request)
  assert.equal(createCalls, 1)
  assert.equal(statusCalls, 2)
  assert.deepEqual(observedStatuses, ['PROCESSING', 'SUCCEEDED'])
  assert.equal(flowSucceeded.generationId, 'flow-task')
  assert.equal(flowSucceeded.status, 'SUCCEEDED')
  assert.deepEqual(flowSucceeded.videoReference, { referenceType: 'provider-video', reference: 'https://video.example/flow.mp4' })

  const failedFlow = await generateVideoAndWait({
    providerId: 'failed-flow-smoke',
    async generateVideo() {
      return { generationId: 'failed-flow-task', status: 'QUEUED', videoReference: null, providerMetadata: {}, issues: [] }
    },
    async getGenerationStatus() {
      return { generationId: 'failed-flow-task', status: 'FAILED', videoReference: null, providerMetadata: {}, issues: [{ code: 'MODEL_FAILED', message: 'Model failed' }] }
    },
  }, request)
  assert.equal(failedFlow.status, 'FAILED')
  assert.equal(failedFlow.videoReference, null)
  assert.equal(failedFlow.issues[0].code, 'MODEL_FAILED')

  const downloadServer = createHttpServer((request, response) => {
    if (request.url === '/success.mp4') {
      response.writeHead(200, { 'content-type': 'video/mp4' })
      response.end(Buffer.from('development-mp4-smoke'))
      return
    }
    if (request.url === '/invalid-content-type') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('not a video')
      return
    }
    if (request.url === '/empty.mp4') {
      response.writeHead(200, { 'content-type': 'video/mp4' })
      response.end()
      return
    }
    response.writeHead(503, { 'content-type': 'text/plain' })
    response.end('unavailable')
  })
  await new Promise((resolve) => downloadServer.listen(0, '127.0.0.1', resolve))
  try {
    const address = downloadServer.address()
    assert(address && typeof address === 'object')
    const baseUrl = `http://127.0.0.1:${address.port}`
    const outputDirectory = new URL('../output/videos/generated/', import.meta.url)
    const countOutputFiles = async () => {
      try {
        return (await readdir(outputDirectory)).filter((name) => name.endsWith('.mp4')).length
      } catch (error) {
        if (error && error.code === 'ENOENT') return 0
        throw error
      }
    }
    const initialFileCount = await countOutputFiles()

    const consumed = await consumeVideoReference(`${baseUrl}/success.mp4`)
    assert(!('issues' in consumed))
    assert.equal(consumed.contentType, 'video/mp4')
    assert(consumed.fileSize > 0)
    assert.equal((await stat(consumed.filePath)).size, consumed.fileSize)

    const downloadFailure = await consumeVideoReference(`${baseUrl}/download-failure`)
    assert('issues' in downloadFailure)
    assert.equal(downloadFailure.issues[0].code, 'VIDEO_DOWNLOAD_FAILED')

    const invalidContentType = await consumeVideoReference(`${baseUrl}/invalid-content-type`)
    assert('issues' in invalidContentType)
    assert.equal(invalidContentType.issues[0].code, 'INVALID_VIDEO_CONTENT_TYPE')

    const emptyFile = await consumeVideoReference(`${baseUrl}/empty.mp4`)
    assert('issues' in emptyFile)
    assert.equal(emptyFile.issues[0].code, 'EMPTY_VIDEO_FILE')

    const invalidUrl = await consumeVideoReference('not-a-url')
    assert('issues' in invalidUrl)
    assert.equal(invalidUrl.issues[0].code, 'INVALID_VIDEO_REFERENCE')
    assert.equal(await countOutputFiles(), initialFileCount + 1)
  } finally {
    await new Promise((resolve, reject) => downloadServer.close((error) => error ? reject(error) : resolve()))
  }

  console.log('Infistar Seedance and Kling Video Provider Adapters, generation flow, and reference consumer smoke verification passed')
} finally {
  await server.close()
}
