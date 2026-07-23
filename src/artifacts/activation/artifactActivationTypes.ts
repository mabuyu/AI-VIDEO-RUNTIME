import type { VideoArtifactConsumer } from '../ingestion/createVideoArtifactIngestionPort'
import type { ArtifactRuntimePublicationPort } from '../runtime'

export interface ArtifactActivationDependencies {
  readonly videoArtifactConsumer?: VideoArtifactConsumer
  readonly runtimePublicationPort?: ArtifactRuntimePublicationPort
}
