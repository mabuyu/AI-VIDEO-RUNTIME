import type { GenerationOutput } from './generationOutput'

export interface ArtifactCreationBoundary {
  createArtifactCandidate(output: GenerationOutput): Promise<void>
}
