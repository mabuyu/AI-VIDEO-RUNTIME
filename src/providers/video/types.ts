export type JsonPrimitive = string | number | boolean | null
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

export interface VideoCameraMovement {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly movement: string
}

export interface VideoCameraPlan {
  readonly description: string
  readonly movements: readonly VideoCameraMovement[]
}

export interface VideoTimelineSegment {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly description: string
}

export interface VideoTimelinePlan {
  readonly segments: readonly VideoTimelineSegment[]
}

export interface VideoStylePlan {
  readonly description: string
  readonly tags: readonly string[]
}

export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | string

export interface VideoGenerationRequest {
  readonly generationRequestId: string
  readonly prompt: string
  readonly sceneDescription: string
  readonly cameraPlan: VideoCameraPlan
  readonly timeline: VideoTimelinePlan
  readonly durationSeconds: number
  readonly aspectRatio: VideoAspectRatio
  readonly style: VideoStylePlan
  readonly metadata: Readonly<Record<string, JsonValue>>
}

export type VideoGenerationStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'

export interface VideoReference {
  readonly referenceType: 'provider-video'
  readonly reference: string
}

export interface VideoGenerationIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
  readonly retryable?: boolean
}

export interface VideoGenerationResult {
  readonly generationId: string
  readonly status: VideoGenerationStatus
  readonly videoReference: VideoReference | null
  readonly providerMetadata: Readonly<Record<string, JsonValue>>
  readonly issues: readonly VideoGenerationIssue[]
}
