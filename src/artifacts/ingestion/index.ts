export { createVideoArtifactIngestionPort } from './createVideoArtifactIngestionPort'
export type { VideoArtifactConsumer } from './createVideoArtifactIngestionPort'
export type {
  ArtifactCandidate,
  ArtifactIngestionIssue,
  ArtifactIngestionPort,
  ArtifactIngestionProductionContext,
  ArtifactIngestionRequest,
  ArtifactIngestionResult,
  ArtifactIngestionValidationResult,
} from './types/artifactIngestion'
export {
  validateArtifactIngestionRequest,
  validateArtifactIngestionResult,
} from './validation/validateArtifactIngestion'
