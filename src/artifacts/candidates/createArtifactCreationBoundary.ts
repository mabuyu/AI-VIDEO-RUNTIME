import type {
  ArtifactCreationBoundary,
  ArtifactIngestionResult,
  GenerationOutput,
} from '../contracts'
import { createArtifactCandidate } from './createArtifactCandidate'

export function createArtifactCreationBoundary(): ArtifactCreationBoundary {
  return Object.freeze({
    async createArtifactCandidate(
      output: GenerationOutput,
    ): Promise<ArtifactIngestionResult> {
      return createArtifactCandidate(output)
    },
  })
}
