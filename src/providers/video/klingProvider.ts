import type { VideoProvider } from './videoProvider'
import type {
  JsonValue,
  VideoGenerationIssue,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
} from './types'

const DEFAULT_MODEL = 'kling-v2-5-turbo'
const DEFAULT_BASE_URL = 'https://infistar.ai'

export interface KlingCredentials {
  readonly apiKey: string
}

export interface KlingProviderConfig {
  readonly credentials: KlingCredentials
  readonly model: string
  readonly baseUrl: string
}

interface KlingCreateTaskRequest {
  readonly model: string
  readonly prompt: string
}

type KlingTaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed'

interface KlingTaskResult {
  readonly taskId: string
  readonly status: KlingTaskStatus
  readonly videoUrl?: string
  readonly metadata?: Readonly<Record<string, JsonValue>>
}

export interface KlingApiClient {
  createTask(request: KlingCreateTaskRequest): Promise<KlingTaskResult>
  getTask(generationId: string): Promise<KlingTaskResult>
}

export type KlingEnvironment = Readonly<Record<string, string | undefined>>

export function resolveKlingProviderConfig(environment: KlingEnvironment): KlingProviderConfig {
  const apiKey = environment.KLING_API_KEY?.trim()
  if (!apiKey) throw new Error('KLING_API_KEY is required')

  return {
    credentials: { apiKey },
    model: environment.KLING_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: environment.KLING_BASE_URL?.trim() || DEFAULT_BASE_URL,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

type KlingRequestOperation = 'create' | 'query'

const SENSITIVE_FIELD_PATTERN = /authorization|api[-_]?key|token|secret|credential|password/i

function redactDiagnosticString(value: string): string {
  return value
    .replace(/(bearer\s+)[^\s"',}]+/gi, '$1[REDACTED]')
    .replace(/(authorization|api[-_]?key|token|secret|credential|password)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[REDACTED]')
}

function sanitizeDiagnosticValue(value: unknown): unknown {
  if (typeof value === 'string') return redactDiagnosticString(value)
  if (Array.isArray(value)) return value.map(sanitizeDiagnosticValue)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key) ? '[REDACTED]' : sanitizeDiagnosticValue(fieldValue),
    ]),
  )
}

function readProviderError(body: unknown): { readonly code: string | null; readonly message: string | null } {
  if (!isRecord(body)) return { code: null, message: null }

  const data = isRecord(body.data) ? body.data : undefined
  const candidates = [
    isRecord(body.error) ? body.error : undefined,
    isRecord(data?.error) ? data.error : undefined,
    body,
    data,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const rawCode = candidate.code ?? candidate.error_code ?? candidate.errorCode
    const code = typeof rawCode === 'number' ? String(rawCode) : readString(rawCode)
    const message = readString(candidate.message)
      ?? readString(candidate.error_message)
      ?? readString(candidate.errorMessage)
    if (code || message) {
      return {
        code: code ? redactDiagnosticString(code) : null,
        message: message ? redactDiagnosticString(message) : null,
      }
    }
  }

  return { code: null, message: null }
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
  operation: KlingRequestOperation,
  httpStatus: number | null,
  responseBody: unknown,
): void {
  const diagnostic: Record<string, unknown> = {
    operation,
    httpStatus,
    responseBody: sanitizeDiagnosticValue(responseBody),
  }

  if (operation === 'create') {
    const providerError = readProviderError(responseBody)
    diagnostic.providerErrorCode = providerError.code
    diagnostic.providerErrorMessage = providerError.message
  }

  console.error('[KlingProvider debug]', diagnostic)
}

function readTaskContainer(body: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(body)) return body.length === 1 && isRecord(body[0]) ? body[0] : undefined
  if (!isRecord(body)) return undefined

  const data = body.data
  if (Array.isArray(data)) return data.length === 1 && isRecord(data[0]) ? data[0] : undefined
  if (isRecord(data)) return data

  const tasks = body.tasks
  if (Array.isArray(tasks)) return tasks.length === 1 && isRecord(tasks[0]) ? tasks[0] : undefined
  return body
}

function readVideoUrl(task: Record<string, unknown>): string | undefined {
  const output = isRecord(task.output) ? task.output : undefined
  const result = isRecord(task.result) ? task.result : undefined
  const taskResult = isRecord(task.task_result) ? task.task_result : undefined
  const videos = Array.isArray(taskResult?.videos)
    ? taskResult.videos
    : Array.isArray(task.videos)
      ? task.videos
      : undefined
  const firstVideo = videos && videos.length > 0 && isRecord(videos[0]) ? videos[0] : undefined

  return readString(task.video_url)
    ?? readString(task.videoUrl)
    ?? readString(output?.video_url)
    ?? readString(output?.videoUrl)
    ?? readString(result?.video_url)
    ?? readString(result?.videoUrl)
    ?? readString(firstVideo?.url)
}

function normalizeProviderStatus(value: unknown): KlingTaskStatus | undefined {
  const status = readString(value)?.toLowerCase()
  if (!status) return undefined
  if (['submitted', 'queued', 'waiting', 'pending'].includes(status)) return 'submitted'
  if (['processing', 'running'].includes(status)) return 'processing'
  if (['success', 'succeed', 'succeeded', 'completed'].includes(status)) return 'succeed'
  if (['failed', 'failure', 'error'].includes(status)) return 'failed'
  return undefined
}

function parseTask(body: unknown): KlingTaskResult {
  const task = readTaskContainer(body)
  const taskId = task ? readString(task.task_id) ?? readString(task.taskId) ?? readString(task.id) : undefined
  const status = task ? normalizeProviderStatus(task.task_status ?? task.status) : undefined
  if (!task || !taskId || !status) {
    throw new Error('Kling API returned an invalid task response')
  }

  return {
    taskId,
    status,
    videoUrl: readVideoUrl(task),
    metadata: { providerTaskId: taskId },
  }
}

function parseCreateTask(body: unknown): KlingTaskResult {
  const task = readTaskContainer(body)
  const taskId = task ? readString(task.task_id) ?? readString(task.taskId) ?? readString(task.id) : undefined
  const rawStatus = task ? task.task_status ?? task.status : undefined
  const status = rawStatus === undefined ? 'submitted' : normalizeProviderStatus(rawStatus)
  if (!task || !taskId || !status) {
    throw new Error('Kling API returned an invalid create response')
  }

  return {
    taskId,
    status,
    videoUrl: readVideoUrl(task),
    metadata: { providerTaskId: taskId },
  }
}

function createFetchKlingApiClient(config: KlingProviderConfig): KlingApiClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  async function requestTask(
    operation: KlingRequestOperation,
    url: string,
    init: RequestInit,
    parse: (body: unknown) => KlingTaskResult,
  ): Promise<KlingTaskResult> {
    let httpStatus: number | null = null
    let responseBody: unknown = null

    try {
      const response = await fetch(url, init)
      httpStatus = response.status
      responseBody = parseResponseBody(await response.text())
      if (!response.ok) throw new Error('Kling API request failed')
      return parse(responseBody)
    } catch {
      logRequestFailure(operation, httpStatus, responseBody)
      throw new Error('Kling API request failed')
    }
  }

  const headers = {
    Authorization: `Bearer ${config.credentials.apiKey}`,
    'Content-Type': 'application/json',
  }

  return {
    async createTask(request) {
      return requestTask('create', `${baseUrl}/kling/v1/videos/text2video`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      }, parseCreateTask)
    },
    async getTask(generationId) {
      return requestTask('query', `${baseUrl}/v1/video/generations/${encodeURIComponent(generationId)}`, {
        method: 'GET',
        headers,
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

function normalizeStatus(status: KlingTaskResult['status']): VideoGenerationStatus {
  if (status === 'submitted') return 'QUEUED'
  if (status === 'processing') return 'PROCESSING'
  if (status === 'succeed') return 'SUCCEEDED'
  return 'FAILED'
}

export class KlingProvider implements VideoProvider {
  readonly providerId = 'kling'
  readonly #model: string
  readonly #client: KlingApiClient

  constructor(config: KlingProviderConfig, client: KlingApiClient = createFetchKlingApiClient(config)) {
    this.#model = config.model
    this.#client = client
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const validationIssues = validateRequest(request)
    if (validationIssues.length > 0) return this.failure(request.generationRequestId, validationIssues)

    try {
      const task = await this.#client.createTask({
        model: this.#model,
        prompt: buildPrompt(request),
      })
      return this.normalizeTask(task)
    } catch {
      return this.failure(request.generationRequestId, [{ code: 'PROVIDER_CALL_FAILED', message: 'Kling provider call failed' }])
    }
  }

  async getGenerationStatus(generationId: string): Promise<VideoGenerationResult> {
    if (!generationId.trim()) {
      return this.failure(generationId, [{ code: 'INVALID_GENERATION_ID', message: 'generationId is required', path: 'generationId' }])
    }

    try {
      const task = await this.#client.getTask(generationId)
      if (task.taskId !== generationId) {
        return this.failure(generationId, [{ code: 'INVALID_PROVIDER_RESPONSE', message: 'Kling status response identity does not match generationId' }])
      }
      return this.normalizeTask(task)
    } catch {
      return this.failure(generationId, [{ code: 'PROVIDER_STATUS_QUERY_FAILED', message: 'Kling status query failed' }])
    }
  }

  private normalizeTask(task: KlingTaskResult): VideoGenerationResult {
    const status = normalizeStatus(task.status)
    if (status === 'FAILED') {
      return this.failure(task.taskId, [{ code: 'PROVIDER_GENERATION_FAILED', message: 'Kling generation failed' }], task.metadata)
    }
    if (status === 'SUCCEEDED' && !task.videoUrl) {
      return this.failure(task.taskId, [{ code: 'INVALID_PROVIDER_RESPONSE', message: 'Kling succeeded without a video reference' }], task.metadata)
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
