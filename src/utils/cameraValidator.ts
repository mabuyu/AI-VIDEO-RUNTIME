import cameras from '../data/camera.json'
import type { CameraTrack } from './cameraParser'

export function validateCamera() {
  const errors: string[] = []

  cameras.forEach((camera: CameraTrack, index: number) => {
    if (!camera.id) {
      errors.push(`camera ${index}: id missing`)
    }

    if (typeof camera.start !== 'number') {
      errors.push(`camera ${index}: start invalid`)
    }

    if (typeof camera.duration !== 'number') {
      errors.push(`camera ${index}: duration invalid`)
    }

    if (typeof camera.scaleFrom !== 'number') {
      errors.push(`camera ${index}: scaleFrom invalid`)
    }

    if (typeof camera.scaleTo !== 'number') {
      errors.push(`camera ${index}: scaleTo invalid`)
    }

    if (typeof camera.xFrom !== 'number') {
      errors.push(`camera ${index}: xFrom invalid`)
    }

    if (typeof camera.xTo !== 'number') {
      errors.push(`camera ${index}: xTo invalid`)
    }

    if (typeof camera.yFrom !== 'number') {
      errors.push(`camera ${index}: yFrom invalid`)
    }

    if (typeof camera.yTo !== 'number') {
      errors.push(`camera ${index}: yTo invalid`)
    }

    if (typeof camera.shake !== 'number') {
      errors.push(`camera ${index}: shake invalid`)
    }

    if (camera.preset && typeof camera.preset !== 'string') {
      errors.push(`camera ${index}: preset invalid`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}