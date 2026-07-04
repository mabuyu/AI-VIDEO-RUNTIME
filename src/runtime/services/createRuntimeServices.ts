import type { RuntimeReaders } from '../../runtimeData'
import { createCameraService } from './camera/cameraService'
import { createPlaybackService } from './playback/playbackService'
import { createSceneService } from './scene/sceneService'
import { createSubtitleService } from './subtitle/subtitleService'
import type { RuntimeServices } from './types'

export function createRuntimeServices(
  readers: RuntimeReaders,
): RuntimeServices {
  return {
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
  }
}
