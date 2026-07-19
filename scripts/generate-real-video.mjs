import { stat } from 'node:fs/promises'
import { createServer } from 'vite'

const PROMPT = `A cinematic short video of a futuristic city at night,
neon lights reflecting on wet streets,
a flying vehicle passing between skyscrapers,
high quality cinematic camera movement.`

const MAX_POLLING_ATTEMPTS = 120
const POLLING_INTERVAL_MS = 5_000

function printResult(label, result) {
  console.log(`${label}: ${result.status}`)
  console.log(`generationId: ${result.generationId}`)
  if (result.videoReference) {
    console.log(`videoReference: ${result.videoReference.reference}`)
  }
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const {
    SeedanceProvider,
    consumeVideoReference,
    generateVideoAndWait,
    resolveSeedanceProviderConfig,
  } = await server.ssrLoadModule('/src/providers/video/index.ts')

  const provider = new SeedanceProvider(resolveSeedanceProviderConfig(process.env))
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
    generationRequestId: `real-seedance-${Date.now()}`,
    prompt: PROMPT,
    sceneDescription: 'A futuristic city at night with wet streets, neon reflections, skyscrapers, and one flying vehicle.',
    cameraPlan: {
      description: 'High quality cinematic camera movement through the city.',
      movements: [{ startSeconds: 0, endSeconds: 5, movement: 'smooth forward tracking shot' }],
    },
    timeline: {
      segments: [{ startSeconds: 0, endSeconds: 5, description: 'The camera moves through the neon city as a flying vehicle passes between skyscrapers.' }],
    },
    durationSeconds: 5,
    aspectRatio: '16:9',
    style: { description: 'cinematic, high quality', tags: ['night', 'neon', 'futuristic'] },
    metadata: { validationTask: 'stage3-milestone3d-task-d6' },
  }

  const generated = await generateVideoAndWait(observedProvider, request, {
    maxPollingAttempts: MAX_POLLING_ATTEMPTS,
    pollingIntervalMs: POLLING_INTERVAL_MS,
  })
  printResult('final status', generated)

  if (generated.status !== 'SUCCEEDED' || !generated.videoReference) {
    const details = generated.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')
    throw new Error(`Real Seedance generation failed${details ? `: ${details}` : ''}`)
  }

  const consumed = await consumeVideoReference(generated.videoReference.reference)
  if ('issues' in consumed) {
    const details = consumed.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')
    throw new Error(`Video reference consumption failed: ${details}`)
  }

  const fileInfo = await stat(consumed.filePath)
  if (!fileInfo.isFile() || fileInfo.size <= 0) {
    throw new Error('Downloaded MP4 validation failed: output file is missing or empty')
  }
  if (consumed.contentType !== 'video/mp4') {
    throw new Error(`Downloaded MP4 validation failed: unexpected content type ${consumed.contentType}`)
  }

  console.log(`MP4 file: ${consumed.filePath}`)
  console.log(`MP4 size: ${consumed.fileSize} bytes`)
  console.log(`MP4 content type: ${consumed.contentType}`)
  console.log('Real Seedance Provider generation validation passed')
} finally {
  await server.close()
}
