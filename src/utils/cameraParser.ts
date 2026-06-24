import cameras from '../data/camera.json'
import { getCameraPreset } from './cameraPresets'

export type CameraTrack = {
  id: string
  preset?: string

  start: number
  duration: number

  scaleFrom: number
  scaleTo: number

  xFrom: number
  xTo: number

  yFrom: number
  yTo: number

  shake: number
}

function applyCameraPreset(camera: CameraTrack): CameraTrack {
  const preset = getCameraPreset(camera.preset)

  if (!preset) {
    return camera
  }

  return {
    ...camera,
    scaleFrom: preset.scaleFrom,
    scaleTo: preset.scaleTo,
    xFrom: preset.xFrom,
    xTo: preset.xTo,
    yFrom: preset.yFrom,
    yTo: preset.yTo,
    shake: preset.shake,
  }
}

export function getCameras(): CameraTrack[] {
  return (cameras as CameraTrack[]).map(applyCameraPreset)
}

export function getCurrentCamera(currentTime: number): CameraTrack | null {
  return (
    getCameras().find(
      (camera) =>
        currentTime >= camera.start &&
        currentTime < camera.start + camera.duration
    ) || null
  )
}