import type { GenerationOutput } from './generationOutput'
import type { ArtifactIngestionResult } from './artifactIngestionResult'

export interface ArtifactCreationBoundary {
  createArtifactCandidate(
    output: GenerationOutput,
  ): Promise<ArtifactIngestionResult>
}
