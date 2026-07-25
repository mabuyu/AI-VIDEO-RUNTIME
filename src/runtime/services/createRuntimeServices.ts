import type { RuntimeReaders } from '../../runtimeData'
import {
  createRuntimeArtifactService,
  type RuntimeArtifactConsumptionAdapter,
} from './artifact'
import { createCameraService } from './camera/cameraService'
import { createPlaybackService } from './playback/playbackService'
import { createProjectService } from './project/projectService'
import { createSceneService } from './scene/sceneService'
import { createSubtitleService } from './subtitle/subtitleService'
import type { RuntimeServices } from './types'

export function createRuntimeServices(
  readers: RuntimeReaders,
  artifactConsumptionAdapter?: RuntimeArtifactConsumptionAdapter,
): RuntimeServices {
  return {
    project: createProjectService({
      projectReader: readers.project,
    }),
    playback: createPlaybackService({
      timelineReader: readers.timeline,
    }),
    scene: createSceneService({
      sceneReader: readers.scene,
    }),
    subtitle: createSubtitleService({
      subtitleReader: readers.subtitle,
    }),
    camera: createCameraService({
      cameraReader: readers.camera,
    }),
    artifact:
      artifactConsumptionAdapter === undefined
        ? createRuntimeArtifactService()
        : createRuntimeArtifactService(artifactConsumptionAdapter),
  }
}
