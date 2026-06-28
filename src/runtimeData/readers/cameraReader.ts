import type { RuntimeDataV1 } from '../types'
import type { CameraReader } from './types'

export function createCameraReader(
  runtimeData: RuntimeDataV1,
): CameraReader {
  return {
    getCameras() {
      return runtimeData.camera
    },
    getCurrentCamera(timeMs: number) {
      return (
        runtimeData.camera.find(
          (camera) =>
            timeMs >= camera.start &&
            timeMs < camera.start + camera.duration,
        ) ?? null
      )
    },
  }
}
