import type { ArtifactRuntimeLocation } from '../../../artifacts/runtime'
import {
  createRuntimeArtifactIssue,
  createRuntimeArtifactResolutionFailure,
} from './runtimeArtifactResult'
import type {
  RuntimeArtifactResolutionResult,
  RuntimeArtifactResolver,
  RuntimeArtifactResource,
} from './types'

function resolveLocalFile(
  location: ArtifactRuntimeLocation,
): RuntimeArtifactResolutionResult {
  if (location.path.trim().length === 0) {
    return createRuntimeArtifactResolutionFailure([
      createRuntimeArtifactIssue(
        'RESOLUTION_FAILED',
        'Runtime Artifact location path must be non-empty',
      ),
    ])
  }

  const resource: RuntimeArtifactResource = Object.freeze({
    type: 'runtime-video-source',
    source: location.path,
  })

  return Object.freeze({ ok: true, resource })
}

export function createRuntimeArtifactResolver(): RuntimeArtifactResolver {
  return Object.freeze({
    async resolve(
      location: ArtifactRuntimeLocation,
      artifactType: 'video',
    ) {
      if (artifactType !== 'video') {
        return createRuntimeArtifactResolutionFailure([
          createRuntimeArtifactIssue(
            'UNSUPPORTED_ARTIFACT_TYPE',
            'Runtime Artifact Resolver supports only video artifacts',
          ),
        ])
      }

      if (location.type !== 'local-file') {
        return createRuntimeArtifactResolutionFailure([
          createRuntimeArtifactIssue(
            'UNSUPPORTED_LOCATION_TYPE',
            'Runtime Artifact Resolver supports only local-file locations',
          ),
        ])
      }

      return resolveLocalFile(location)
    },
  })
}
