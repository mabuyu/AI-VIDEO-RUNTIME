export interface ArtifactCandidateSourceMetadata {
  readonly taskId: string
  readonly providerTaskId: string
}

export interface ArtifactCandidate {
  readonly candidateId: string
  readonly generationOutputId: string
  readonly generationResultId: string
  readonly providerId: string
  readonly outputReference: string
  readonly mediaType: 'video'
  readonly format: string
  readonly sourceMetadata: ArtifactCandidateSourceMetadata
}
