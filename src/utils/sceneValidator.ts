import type { RuntimeScene } from './sceneParser'

export function validateScene(scene: RuntimeScene) {
  const errors: string[] = []

  if (!scene.scene) errors.push('scene is required')
  if (typeof scene.start !== 'number') errors.push('start must be number')
  if (typeof scene.duration !== 'number') errors.push('duration must be number')
  if (!scene.text) errors.push('text is required')
  if (!scene.highlight) errors.push('highlight is required')
  if (!scene.background) errors.push('background is required')
  if (!scene.position) errors.push('position is required')
  if (!scene.animation) errors.push('animation is required')

  if (!scene.camera) {
    errors.push('camera is required')
  } else {
    if (typeof scene.camera.scaleFrom !== 'number') {
      errors.push('camera.scaleFrom must be number')
    }

    if (typeof scene.camera.scaleTo !== 'number') {
      errors.push('camera.scaleTo must be number')
    }

    if (typeof scene.camera.xFrom !== 'number') {
      errors.push('camera.xFrom must be number')
    }

    if (typeof scene.camera.xTo !== 'number') {
      errors.push('camera.xTo must be number')
    }

    if (typeof scene.camera.yFrom !== 'number') {
      errors.push('camera.yFrom must be number')
    }

    if (typeof scene.camera.yTo !== 'number') {
      errors.push('camera.yTo must be number')
    }

    if (typeof scene.camera.shake !== 'number') {
      errors.push('camera.shake must be number')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateScenes(scenes: RuntimeScene[]) {
  return scenes.map((scene, index) => {
    return {
      index,
      scene: scene.scene,
      ...validateScene(scene),
    }
  })
}