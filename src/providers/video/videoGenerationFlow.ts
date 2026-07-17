import type { VideoProvider } from './videoProvider'
import type {
  VideoGenerationIssue,
  VideoGenerationRequest,
  VideoGenerationResult,
} from './types'

export const VIDEO_GENERATION_MAX_POLLING_ATTEMPTS = 10
export const VIDEO_GENERATION_POLLING_INTERVAL_MS = 1_000

function failure(
  generationId: string,
  issues: readonly VideoGenerationIssue[],
): VideoGenerationResult {
  return {
    generationId,
    status: 'FAILED',
    videoReference: null,
    providerMetadata: {},
    issues,
  }
}

function validateResult(
  result: VideoGenerationResult,
  expectedGenerationId?: string,
): VideoGenerationResult | undefined {
  if (!result.generationId.trim()) {
    return failure('', [{
      code: 'INVALID_GENERATION_RESULT',
      message: 'Video provider result is missing generationId',
      path: 'generationId',
    }])
  }

  if (expectedGenerationId && result.generationId !== expectedGenerationId) {
    return failure(expectedGenerationId, [{
      code: 'GENERATION_ID_MISMATCH',
      message: 'Video provider status result does not match generationId',
      path: 'generationId',
    }])
  }

  if (result.status === 'SUCCEEDED' && !result.videoReference) {
    return failure(result.generationId, [{
      code: 'MISSING_VIDEO_REFERENCE',
      message: 'Succeeded video generation must include videoReference',
      path: 'videoReference',
    }])
  }

  if (result.status === 'FAILED' && result.issues.length === 0) {
    return failure(result.generationId, [{
      code: 'VIDEO_GENERATION_FAILED',
      message: 'Video generation failed without provider issues',
    }])
  }

  return undefined
}

function waitForPollingInterval(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, VIDEO_GENERATION_POLLING_INTERVAL_MS)
  })
}

export async function generateVideoAndWait(
  provider: VideoProvider,
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  let created: VideoGenerationResult
  try {
    created = await provider.generateVideo(request)
  } catch {
    return failure(request.generationRequestId, [{
      code: 'VIDEO_TASK_CREATION_FAILED',
      message: 'Video provider task creation failed',
    }])
  }
  const invalidCreated = validateResult(created)
  if (invalidCreated) return invalidCreated

  const generationId = created.generationId
  if (created.status === 'SUCCEEDED' || created.status === 'FAILED') return created

  for (let attempt = 0; attempt < VIDEO_GENERATION_MAX_POLLING_ATTEMPTS; attempt += 1) {
    await waitForPollingInterval()

    let statusResult: VideoGenerationResult
    try {
      statusResult = await provider.getGenerationStatus(generationId)
    } catch {
      return failure(generationId, [{
        code: 'VIDEO_STATUS_POLLING_FAILED',
        message: 'Video provider status polling failed',
      }])
    }
    const invalidStatus = validateResult(statusResult, generationId)
    if (invalidStatus) return invalidStatus

    if (statusResult.status === 'SUCCEEDED' || statusResult.status === 'FAILED') {
      return statusResult
    }
  }

  return failure(generationId, [{
    code: 'POLLING_ATTEMPTS_EXHAUSTED',
    message: `Video generation did not reach a terminal status after ${VIDEO_GENERATION_MAX_POLLING_ATTEMPTS} polling attempts`,
    retryable: true,
  }])
}
