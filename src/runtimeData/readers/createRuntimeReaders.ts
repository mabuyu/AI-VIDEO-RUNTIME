import type { RuntimeDataV1 } from '../types'
import { createCameraReader } from './cameraReader'
import { createProjectReader } from './projectReader'
import { createSceneReader } from './sceneReader'
import { createSubtitleReader } from './subtitleReader'
import { createTimelineReader } from './timelineReader'
import type { RuntimeReaders } from './types'

export function createRuntimeReaders(
  runtimeData: RuntimeDataV1,
): RuntimeReaders {
  return {
    project: createProjectReader(runtimeData),
    scene: createSceneReader(runtimeData),
    subtitle: createSubtitleReader(runtimeData),
    timeline: createTimelineReader(runtimeData),
    camera: createCameraReader(runtimeData),
  }
}
