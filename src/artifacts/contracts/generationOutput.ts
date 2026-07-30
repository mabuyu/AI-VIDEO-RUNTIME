export interface GenerationOutputMetadata {
  readonly mediaType: 'video'
  readonly format: string
  readonly taskId: string
  readonly providerTaskId: string
}

export interface GenerationOutput {
  readonly id: string
  readonly generationResultId: string
  readonly providerId: string
  readonly outputReference: string
  readonly metadata: GenerationOutputMetadata
}
