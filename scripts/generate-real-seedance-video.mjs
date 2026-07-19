import { open, stat } from 'node:fs/promises'
import { createServer } from 'vite'

const PROMPT = `A cinematic shot of a futuristic city at night,
neon lights reflecting on wet streets,
a flying vehicle passing between skyscrapers,
smooth forward camera movement,
high quality film style`

const MAX_POLLING_ATTEMPTS = 120
const POLLING_INTERVAL_MS = 5_000

function requireValidationEnvironment(environment) {
  if (!environment.SEEDANCE_API_KEY?.trim()) throw new Error('SEEDANCE_API_KEY is required')
}

function printEnvironmentPresence(environment) {
  for (const name of ['SEEDANCE_API_KEY', 'SEEDANCE_MODEL', 'SEEDANCE_BASE_URL']) {
    console.log(`${name}: ${environment[name]?.trim() ? 'present' : 'missing'}`)
  }
}

function redactVideoReference(reference) {
  try {
    const url = new URL(reference)
    for (const name of url.searchParams.keys()) {
      if (/authorization|api[-_]?key|token|secret|credential|password|signature/i.test(name)) {
        url.searchParams.set(name, '[REDACTED]')
      }
    }
    return url.toString()
  } catch {
    return '[INVALID_URL]'
  }
}

function printResult(label, result) {
  console.log(`${label}: ${result.status}`)
  console.log(`generationId: ${result.generationId}`)
  if (result.videoReference) console.log(`videoReference: ${redactVideoReference(result.videoReference.reference)}`)
}

function captureProviderDiagnostic(args, diagnostics) {
  const candidate = args[0]
  if (!candidate || typeof candidate !== 'object') return
  const httpStatus = Number.isInteger(candidate.httpStatus) ? candidate.httpStatus : null
  const responseText = JSON.stringify(candidate.response ?? '').toLowerCase()
  diagnostics.push({ httpStatus, responseText })
}

function classifyFailure(issues, diagnostics) {
  const issueText = issues.map((issue) => `${issue.code} ${issue.message}`).join(' ').toLowerCase()
  const diagnosticText = diagnostics.map((item) => item.responseText).join(' ')
  const httpStatuses = diagnostics.map((item) => item.httpStatus)

  if (httpStatuses.some((status) => status === 401 || status === 403) || /unauthori[sz]ed|invalid api key|authentication/.test(diagnosticText)) {
    return 'AUTH_FAILED'
  }
  if (httpStatuses.some((status) => status === 402 || status === 429) || /quota|insufficient|balance|limit|fail_to_fetch_task/.test(diagnosticText)) {
    return 'QUOTA_EXHAUSTED'
  }
  if (/invalid_provider_response|invalid_generation_result|generation_id_mismatch|missing_video_reference|invalid_video_reference|invalid_video_content_type|empty_video_file/.test(issueText)) {
    return 'CONTRACT_ERROR'
  }
  return 'PROVIDER_ERROR'
}

async function validateMp4Signature(filePath) {
  const file = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(12)
    const { bytesRead } = await file.read(header, 0, header.length, 0)
    return bytesRead >= 12 && header.subarray(4, 8).toString('ascii') === 'ftyp'
  } finally {
    await file.close()
  }
}

printEnvironmentPresence(process.env)

try {
  requireValidationEnvironment(process.env)
} catch {
  console.log('classification: CONTRACT_ERROR')
  console.log('real API call: NOT_CALLED')
  console.log('generationId: NOT_CREATED')
  console.log('final status: FAILED')
  console.log('videoReference: NOT_CREATED')
  console.log('MP4 validation: NOT_RUN')
  process.exitCode = 1
  process.exit()
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

let restoreConsoleError = () => {}

try {
  const {
    SeedanceProvider,
    consumeVideoReference,
    generateVideoAndWait,
    resolveSeedanceProviderConfig,
  } = await server.ssrLoadModule('/src/providers/video/index.ts')

  const provider = new SeedanceProvider(resolveSeedanceProviderConfig(process.env))
  const providerDiagnostics = []
  const originalConsoleError = console.error
  console.error = (...args) => captureProviderDiagnostic(args, providerDiagnostics)
  restoreConsoleError = () => { console.error = originalConsoleError }
  const observedProvider = {
    providerId: provider.providerId,
    async generateVideo(request) {
      const result = await provider.generateVideo(request)
      console.log('real API call: CALLED')
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
    generationRequestId: `real-infistar-seedance-${Date.now()}`,
    prompt: PROMPT,
    sceneDescription: 'A futuristic city at night with wet streets, neon reflections, skyscrapers, and one flying vehicle.',
    cameraPlan: {
      description: 'A smooth cinematic forward tracking shot.',
      movements: [{ startSeconds: 0, endSeconds: 5, movement: 'smooth forward tracking' }],
    },
    timeline: {
      segments: [{ startSeconds: 0, endSeconds: 5, description: 'The camera advances through the neon city as a flying vehicle crosses the frame.' }],
    },
    durationSeconds: 5,
    aspectRatio: '16:9',
    style: {
      description: 'cinematic lighting and high quality film style',
      tags: ['night', 'neon', 'futuristic'],
    },
    metadata: { validationTask: 'stage3-milestone3d-task-d6.3.3' },
  }

  const generated = await generateVideoAndWait(observedProvider, request, {
    maxPollingAttempts: MAX_POLLING_ATTEMPTS,
    pollingIntervalMs: POLLING_INTERVAL_MS,
  })
  printResult('final status', generated)

  if (generated.status !== 'SUCCEEDED' || !generated.videoReference) {
    console.log(`classification: ${classifyFailure(generated.issues, providerDiagnostics)}`)
    console.log('videoReference: NOT_CREATED')
    console.log('MP4 validation: NOT_RUN')
    process.exitCode = 1
    throw new Error('VALIDATION_RESULT_REPORTED')
  }

  const consumed = await consumeVideoReference(generated.videoReference.reference)
  if ('issues' in consumed) {
    console.log(`classification: ${classifyFailure(consumed.issues, providerDiagnostics)}`)
    console.log('MP4 validation: FAILED')
    process.exitCode = 1
    throw new Error('VALIDATION_RESULT_REPORTED')
  }

  const fileInfo = await stat(consumed.filePath)
  if (!fileInfo.isFile() || fileInfo.size <= 0 || fileInfo.size !== consumed.fileSize) {
    throw new Error('Downloaded MP4 validation failed: output file is missing, empty, or has an inconsistent size')
  }
  if (consumed.contentType !== 'video/mp4') {
    throw new Error('Downloaded MP4 validation failed: unexpected content type')
  }
  const hasMp4Signature = await validateMp4Signature(consumed.filePath)
  if (!hasMp4Signature) throw new Error('Downloaded MP4 validation failed: missing ISO BMFF ftyp signature')

  restoreConsoleError()
  console.log(`MP4 file: ${consumed.filePath}`)
  console.log(`MP4 size: ${consumed.fileSize} bytes`)
  console.log(`MP4 content type: ${consumed.contentType}`)
  console.log('MP4 signature: PASS (ftyp)')
  console.log('MP4 validation: PASS')
  console.log('Real Infistar Seedance Provider generation validation passed')
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'VALIDATION_RESULT_REPORTED') {
    console.log('classification: CONTRACT_ERROR')
    console.log('final status: FAILED')
    console.log('MP4 validation: FAILED')
    process.exitCode = 1
  }
} finally {
  restoreConsoleError()
  await server.close()
}
