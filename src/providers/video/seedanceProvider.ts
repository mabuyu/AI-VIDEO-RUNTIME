import type { VideoProvider } from './videoProvider'
import type {
  JsonValue,
  VideoGenerationIssue,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
} from './types'

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

export interface SeedanceCredentials {
  readonly apiKey: string
}

export interface SeedanceProviderConfig {
  readonly credentials: SeedanceCredentials
  readonly model: string
  readonly baseUrl?: string
}

interface SeedanceCreateTaskRequest {
  readonly model: string
  readonly content: readonly [{ readonly type: 'text'; readonly text: string }]
  readonly duration: number
  readonly ratio: string
}

interface SeedanceCreateTaskResult {
  readonly taskId: string
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed'
  readonly videoUrl?: string
  readonly metadata?: Readonly<Record<string, JsonValue>>
  readonly error?: { readonly code: string; readonly message: string; readonly retryable?: boolean }
}

export interface SeedanceApiClient {
  createTask(request: SeedanceCreateTaskRequest): Promise<SeedanceCreateTaskResult>
}

export type SeedanceEnvironment = Readonly<Record<string, string | undefined>>

export function resolveSeedanceProviderConfig(environment: SeedanceEnvironment): SeedanceProviderConfig {
  const apiKey = environment.SEEDANCE_API_KEY?.trim()
  const model = environment.SEEDANCE_MODEL?.trim()

  if (!apiKey) throw new Error('SEEDANCE_API_KEY is required')
  if (!model) throw new Error('SEEDANCE_MODEL is required')

  return {
    credentials: { apiKey },
    model,
    baseUrl: environment.SEEDANCE_BASE_URL?.trim() || undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function createFetchSeedanceApiClient(config: SeedanceProviderConfig): SeedanceApiClient {
  return {
    async createTask(request) {
      const response = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const error = isRecord(body) && isRecord(body.error) ? body.error : undefined
        throw new Error(readString(error?.message) ?? `Seedance API returned HTTP ${response.status}`)
      }
      if (!isRecord(body)) throw new Error('Seedance API returned an invalid response')

      const taskId = readString(body.id)
      const status = readString(body.status)
      if (!taskId || !status || !['queued', 'running', 'succeeded', 'failed'].includes(status)) {
        throw new Error('Seedance API response is missing task identity or status')
      }

      const content = isRecord(body.content) ? body.content : undefined
      const videoUrl = readString(content?.video_url)
      const providerError = isRecord(body.error) ? body.error : undefined
      return {
        taskId,
        status: status as SeedanceCreateTaskResult['status'],
        videoUrl,
        metadata: { providerTaskId: taskId },
        error: providerError
          ? {
              code: readString(providerError.code) ?? 'SEEDANCE_MODEL_FAILED',
              message: readString(providerError.message) ?? 'Seedance generation failed',
            }
          : undefined,
      }
    },
  }
}

function buildPrompt(request: VideoGenerationRequest): string {
  const camera = request.cameraPlan.movements
    .map((movement) => `${movement.startSeconds}-${movement.endSeconds}s: ${movement.movement}`)
    .join('; ')
  const timeline = request.timeline.segments
    .map((segment) => `${segment.startSeconds}-${segment.endSeconds}s: ${segment.description}`)
    .join('; ')
  const tags = request.style.tags.join(', ')
  return [
    request.prompt,
    `Scene: ${request.sceneDescription}`,
    `Camera: ${request.cameraPlan.description}${camera ? `; ${camera}` : ''}`,
    `Timeline: ${timeline}`,
    `Style: ${request.style.description}${tags ? `; tags: ${tags}` : ''}`,
  ].join('\n')
}

function validateRequest(request: VideoGenerationRequest): readonly VideoGenerationIssue[] {
  const issues: VideoGenerationIssue[] = []
  if (!request.generationRequestId.trim()) issues.push({ code: 'INVALID_REQUEST', message: 'generationRequestId is required', path: 'generationRequestId' })
  if (!request.prompt.trim()) issues.push({ code: 'INVALID_REQUEST', message: 'prompt is required', path: 'prompt' })
  if (!request.sceneDescription.trim()) issues.push({ code: 'INVALID_REQUEST', message: 'sceneDescription is required', path: 'sceneDescription' })
  if (!Number.isFinite(request.durationSeconds) || request.durationSeconds <= 0) issues.push({ code: 'INVALID_REQUEST', message: 'durationSeconds must be positive', path: 'durationSeconds' })
  if (!request.aspectRatio.trim()) issues.push({ code: 'INVALID_REQUEST', message: 'aspectRatio is required', path: 'aspectRatio' })
  return issues
}

function normalizeStatus(status: SeedanceCreateTaskResult['status']): VideoGenerationStatus {
  if (status === 'queued') return 'QUEUED'
  if (status === 'running') return 'PROCESSING'
  if (status === 'succeeded') return 'SUCCEEDED'
  return 'FAILED'
}

export class SeedanceProvider implements VideoProvider {
  readonly providerId = 'seedance'
  readonly #config: SeedanceProviderConfig
  readonly #client: SeedanceApiClient

  constructor(config: SeedanceProviderConfig, client: SeedanceApiClient = createFetchSeedanceApiClient(config)) {
    this.#config = config
    this.#client = client
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const validationIssues = validateRequest(request)
    if (validationIssues.length > 0) return this.failure(request.generationRequestId, validationIssues)

    try {
      const response = await this.#client.createTask({
        model: this.#config.model,
        content: [{ type: 'text', text: buildPrompt(request) }],
        duration: request.durationSeconds,
        ratio: request.aspectRatio,
      })
      const status = normalizeStatus(response.status)
      if (status === 'FAILED') {
        return this.failure(response.taskId, [{
          code: response.error?.code ?? 'PROVIDER_GENERATION_FAILED',
          message: response.error?.message ?? 'Seedance generation failed',
          retryable: response.error?.retryable,
        }], response.metadata)
      }
      if (status === 'SUCCEEDED' && !response.videoUrl) {
        return this.failure(response.taskId, [{ code: 'INVALID_PROVIDER_RESPONSE', message: 'Seedance succeeded without a video reference' }], response.metadata)
      }
      return {
        generationId: response.taskId,
        status,
        videoReference: response.videoUrl ? { referenceType: 'provider-video', reference: response.videoUrl } : null,
        providerMetadata: response.metadata ?? {},
        issues: [],
      }
    } catch {
      return this.failure(request.generationRequestId, [{ code: 'PROVIDER_CALL_FAILED', message: 'Seedance provider call failed' }])
    }
  }

  private failure(generationId: string, issues: readonly VideoGenerationIssue[], providerMetadata: Readonly<Record<string, JsonValue>> = {}): VideoGenerationResult {
    return { generationId, status: 'FAILED', videoReference: null, providerMetadata, issues }
  }
}
