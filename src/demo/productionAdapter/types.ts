export type GenerationQualityTier =
  | 'BASIC'
  | 'STANDARD'
  | 'PROFESSIONAL'
  | 'ENTERPRISE'

export interface GenerationRequest {
  readonly requestId: string
  readonly prompt: string
  readonly style: string
  readonly duration: number
  readonly sceneCount: number
  readonly qualityTier: GenerationQualityTier
}

export type GenerationStatus =
  | 'CREATED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'

export interface GenerationOutput {
  readonly outputId: string
  readonly mediaType: 'video'
  readonly format: string
}

export interface GenerationIssue {
  readonly code: string
  readonly message: string
}

export interface GenerationResult {
  readonly generationId: string
  readonly status: GenerationStatus
  readonly outputs: readonly GenerationOutput[]
  readonly issues: readonly GenerationIssue[]
}

export interface GenerationProviderAdapter {
  generate(request: GenerationRequest): Promise<GenerationResult>
}

export interface ProductionAdapterService {
  generate(request: GenerationRequest): Promise<GenerationResult>
}
