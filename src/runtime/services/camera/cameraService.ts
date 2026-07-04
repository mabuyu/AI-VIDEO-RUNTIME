import type {
  CameraRuntimeState,
  CameraService,
  CameraServiceDependencies,
} from '../types'

function clampProgress(progress: number): number {
  return Math.min(Math.max(progress, 0), 1)
}

export function createCameraService({
  cameraReader,
}: CameraServiceDependencies): CameraService {
  function getCurrentCameraState(timeMs: number): CameraRuntimeState {
    const camera = cameraReader.getCurrentCamera(timeMs)

    if (!camera) {
      return {
        camera: null,
        progress: 0,
        isActive: false,
      }
    }

    return {
      camera,
      progress: clampProgress((timeMs - camera.start) / camera.duration),
      isActive: true,
    }
  }

  return {
    getCurrentCamera(timeMs: number) {
      return cameraReader.getCurrentCamera(timeMs)
    },
    getCurrentCameraState,
  }
}
