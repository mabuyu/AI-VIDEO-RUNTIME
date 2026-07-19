import { stat } from 'node:fs/promises'
import { createServer } from 'vite'

const PROMPT = `A cinematic shot of a futuristic city at night,
neon lights reflecting on wet streets,
a person walking slowly,
camera dolly forward,
cinematic lighting,
high quality film style`

const MAX_POLLING_ATTEMPTS = 120
const POLLING_INTERVAL_MS = 5_000

function requireValidationEnvironment(environment) {
  if (!environment.KLING_API_KEY?.trim()) throw new Error('KLING_API_KEY is required')
}

function printResult(label, result) {
  console.log(`${label}: ${result.status}`)
  console.log(`generationId: ${result.generationId}`)
  if (result.videoReference) console.log(`videoReference: ${result.videoReference.reference}`)
}

requireValidationEnvironment(process.env)

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const {
    KlingProvider,
    consumeVideoReference,
    generateVideoAndWait,
    resolveKlingProviderConfig,
  } = await server.ssrLoadModule('/src/providers/video/index.ts')

  const provider = new KlingProvider(resolveKlingProviderConfig(process.env))
  const observedProvider = {
    providerId: provider.providerId,
    async generateVideo(request) {
      const result = await provider.generateVideo(request)
      printResult('initial status', result)
      return result
    },
    async getGenerationStatus(generationId) {
      const result = await provider.getGenerationStatus(generationId)
      printResult('polled status', result)
      return result
    },
  }

  const request = {
    generationRequestId: `real-kling-${Date.now()}`,
    prompt: PROMPT,
    sceneDescription: 'A person walks slowly through a futuristic neon city at night while reflections move across wet streets.',
    cameraPlan: {
      description: 'A cinematic dolly-forward shot.',
      movements: [{ startSeconds: 0, endSeconds: 10, movement: 'slow dolly forward' }],
    },
    timeline: {
      segments: [{ startSeconds: 0, endSeconds: 10, description: 'The person walks as the camera advances through the neon-lit street.' }],
    },
    durationSeconds: 10,
    aspectRatio: '9:16',
    style: {
      description: 'cinematic lighting, high quality film style, 1080p output',
      tags: ['night', 'neon', 'futuristic', '1080p'],
    },
    metadata: { validationTask: 'stage3-milestone3d-task-d6.2' },
  }

  const generated = await generateVideoAndWait(observedProvider, request, {
    maxPollingAttempts: MAX_POLLING_ATTEMPTS,
    pollingIntervalMs: POLLING_INTERVAL_MS,
  })
  printResult('final status', generated)

  if (generated.status !== 'SUCCEEDED' || !generated.videoReference) {
    const details = generated.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')
    throw new Error(`Real Kling generation failed${details ? `: ${details}` : ''}`)
  }

  const consumed = await consumeVideoReference(generated.videoReference.reference)
  if ('issues' in consumed) {
    const details = consumed.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')
    throw new Error(`Video reference consumption failed: ${details}`)
  }

  const fileInfo = await stat(consumed.filePath)
  if (!fileInfo.isFile() || fileInfo.size <= 0 || fileInfo.size !== consumed.fileSize) {
    throw new Error('Downloaded MP4 validation failed: output file is missing, empty, or has an inconsistent size')
  }
  if (consumed.contentType !== 'video/mp4') {
    throw new Error(`Downloaded MP4 validation failed: unexpected content type ${consumed.contentType}`)
  }

  console.log(`MP4 file: ${consumed.filePath}`)
  console.log(`MP4 size: ${consumed.fileSize} bytes`)
  console.log(`MP4 content type: ${consumed.contentType}`)
  console.log('Real Kling Provider generation validation passed')
} finally {
  await server.close()
}
