import { generatedRuntimeDataV2ArtifactFixture } from '../../fixtures'
import type { GeneratedRuntimeDataV2Source } from './types'

export function createGeneratedRuntimeDataV2Source(): GeneratedRuntimeDataV2Source {
  return {
    type: 'generated',
    artifactId: generatedRuntimeDataV2ArtifactFixture.artifact.id,
    artifactRevision: generatedRuntimeDataV2ArtifactFixture.artifact.revision,
    artifact: generatedRuntimeDataV2ArtifactFixture,
  }
}
