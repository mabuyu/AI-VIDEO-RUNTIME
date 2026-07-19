import type { VideoProvider } from './videoProvider'
import type {
  JsonValue,
  VideoGenerationIssue,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
} from './types'

const DEFAULT_MODEL = 'doubao-seedance-2.0-mini'
const DEFAULT_BASE_URL = 'https://infistar.ai'

export interface SeedanceCredentials {
  readonly apiKey: string
}

export interface SeedanceProviderConfig {
  readonly credentials: SeedanceCredentials
  readonly model: string
  readonly baseUrl: string
}

interface SeedanceCreateTaskRequest {
  readonly model: string
  readonly prompt: string
}

type SeedanceTaskStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

interface SeedanceTaskResult {
  readonly taskId: string
  readonly status: SeedanceTaskStatus
  readonly videoUrl?: string
  readonly metadata?: Readonly<Record<string, JsonValue>>
}

export interface SeedanceApiClient {
  createTask(request: SeedanceCreateTaskRequest): Promise<SeedanceTaskResult>
  getTask(generationId: string): Promise<SeedanceTaskResult>
}

export type SeedanceEnvironment = Readonly<Record<string, string | undefined>>

export function resolveSeedanceProviderConfig(environment: SeedanceEnvironment): SeedanceProviderConfig {
  const apiKey = environment.SEEDANCE_API_KEY?.trim()
  if (!apiKey) throw new Error('SEEDANCE_API_KEY is required')

  return {
    credentials: { apiKey },
    model: environment.SEEDANCE_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: environment.SEEDANCE_BASE_URL?.trim() || DEFAULT_BASE_URL,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

type SeedanceRequestOperation = 'create' | 'query'

const SENSITIVE_FIELD_PATTERN = /authorization|api[-_]?key|token|secret|credential|password/i

function redactDiagnosticString(value: string): string {
  return value
    .replace(/(bearer\s+)[^\s"',}]+/gi, '$1[REDACTED]')
    .replace(/(authorization|api[-_]?key|token|secret|credential|password)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[REDACTED]')
}

function sanitizeResponse(value: unknown): unknown {
  if (typeof value === 'string') return redactDiagnosticString(value)
  if (Array.isArray(value)) return value.map(sanitizeResponse)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key) ? '[REDACTED]' : sanitizeResponse(fieldValue),
    ]),
  )
}

function parseResponseBody(responseText: string): unknown {
  if (!responseText) return null
  try {
    return JSON.parse(responseText) as unknown
  } catch {
    return responseText
  }
}

function logRequestFailure(
  operation: SeedanceRequestOperation,
  httpStatus: number | null,
  responseBody: unknown,
): void {
  console.error({
    operation,
    httpStatus,
    response: sanitizeResponse(responseBody),
  })
}

function readTaskContainer(body: unknown): Record<string, unknown> | undefined {
  if (!isRecord(body)) return undefined
  return isRecord(body.data) ? body.data : body
}

function readTaskId(task: Record<string, unknown>): string | undefined {
  return readString(task.id) ?? readString(task.task_id)
}

function readVideoUrl(task: Record<string, unknown>): string | undefined {
  const content = isRecord(task.content) ? task.content : undefined
  return readString(task.video_url) ?? readString(content?.video_url)
}

function normalizeProviderStatus(value: unknown): SeedanceTaskStatus | undefined {
  const status = readString(value)?.toLowerCase()
  if (!status) return undefined
  if (['queued', 'pending', 'waiting'].includes(status)) return 'queued'
  if (['processing', 'running'].includes(status)) return 'processing'
  if (['success', 'succeeded', 'completed'].includes(status)) return 'succeeded'
  if (['failed', 'error'].includes(status)) return 'failed'
  return undefined
}

function parseCreateTask(body: unknown): SeedanceTaskResult {
  const task = readTaskContainer(body)
  const taskId = task ? readTaskId(task) : undefined
  const rawStatus = task?.status
  const status = rawStatus === undefined ? 'queued' : normalizeProviderStatus(rawStatus)
  if (!task || !taskId || !status) throw new Error('Seedance API returned an invalid create response')

  return {
    taskId,
    status,
    videoUrl: readVideoUrl(task),
    metadata: { providerTaskId: taskId },
  }
}

function parseTask(body: unknown): SeedanceTaskResult {
  const task = readTaskContainer(body)
  const taskId = task ? readTaskId(task) : undefined
  const status = task ? normalizeProviderStatus(task.status) : undefined
  if (!task || !taskId || !status) throw new Error('Seedance API returned an invalid task response')

  return {
    taskId,
    status,
    videoUrl: readVideoUrl(task),
    metadata: { providerTaskId: taskId },
  }
}

function createFetchSeedanceApiClient(config: SeedanceProviderConfig): SeedanceApiClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  async function requestTask(
    operation: SeedanceRequestOperation,
    url: string,
    init: RequestInit,
    parse: (body: unknown) => SeedanceTaskResult,
  ): Promise<SeedanceTaskResult> {
    let httpStatus: number | null = null
    let responseBody: unknown = null

    try {
      const response = await fetch(url, init)
      httpStatus = response.status
      responseBody = parseResponseBody(await response.text())
      if (!response.ok) throw new Error('Seedance API request failed')
      return parse(responseBody)
    } catch {
      logRequestFailure(operation, httpStatus, responseBody)
      throw new Error('Seedance API request failed')
    }
  }

  return {
    async createTask(request) {
      const body = new FormData()
      body.set('model', request.model)
      body.set('prompt', request.prompt)
      return requestTask('create', `${baseUrl}/v1/videos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.credentials.apiKey}` },
        body,
      }, parseCreateTask)
    },
    async getTask(generationId) {
      return requestTask('query', `${baseUrl}/v1/video/generations/${encodeURIComponent(generationId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.credentials.apiKey}` },
      }, parseTask)
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
    `Output: ${request.durationSeconds} seconds; aspect ratio ${request.aspectRatio}`,
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

function normalizeStatus(status: SeedanceTaskStatus): VideoGenerationStatus {
  if (status === 'queued') return 'QUEUED'
  if (status === 'processing') return 'PROCESSING'
  if (status === 'succeeded') return 'SUCCEEDED'
  return 'FAILED'
}

export class SeedanceProvider implements VideoProvider {
  readonly providerId = 'seedance'
  readonly #model: string
  readonly #client: SeedanceApiClient

  constructor(config: SeedanceProviderConfig, client: SeedanceApiClient = createFetchSeedanceApiClient(config)) {
    this.#model = config.model
    this.#client = client
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const validationIssues = validateRequest(request)
    if (validationIssues.length > 0) return this.failure(request.generationRequestId, validationIssues)

    try {
      const task = await this.#client.createTask({ model: this.#model, prompt: buildPrompt(request) })
      return this.normalizeTask(task)
    } catch {
      return this.failure(request.generationRequestId, [{ code: 'PROVIDER_CALL_FAILED', message: 'Seedance provider call failed' }])
    }
  }

  async getGenerationStatus(generationId: string): Promise<VideoGenerationResult> {
    if (!generationId.trim()) {
      return this.failure(generationId, [{ code: 'INVALID_GENERATION_ID', message: 'generationId is required', path: 'generationId' }])
    }

    try {
      const task = await this.#client.getTask(generationId)
      if (task.taskId !== generationId) {
        return this.failure(generationId, [{ code: 'INVALID_PROVIDER_RESPONSE', message: 'Seedance status response identity does not match generationId' }])
      }
      return this.normalizeTask(task)
    } catch {
      return this.failure(generationId, [{ code: 'PROVIDER_STATUS_QUERY_FAILED', message: 'Seedance status query failed' }])
    }
  }

  private normalizeTask(task: SeedanceTaskResult): VideoGenerationResult {
    const status = normalizeStatus(task.status)
    if (status === 'FAILED') {
      return this.failure(task.taskId, [{ code: 'PROVIDER_GENERATION_FAILED', message: 'Seedance generation failed' }], task.metadata)
    }
    if (status === 'SUCCEEDED' && !task.videoUrl) {
      return this.failure(task.taskId, [{ code: 'INVALID_PROVIDER_RESPONSE', message: 'Seedance succeeded without a video reference' }], task.metadata)
    }

    return {
      generationId: task.taskId,
      status,
      videoReference: task.videoUrl ? { referenceType: 'provider-video', reference: task.videoUrl } : null,
      providerMetadata: task.metadata ?? {},
      issues: [],
    }
  }

  private failure(
    generationId: string,
    issues: readonly VideoGenerationIssue[],
    providerMetadata: Readonly<Record<string, JsonValue>> = {},
  ): VideoGenerationResult {
    return { generationId, status: 'FAILED', videoReference: null, providerMetadata, issues }
  }
}
