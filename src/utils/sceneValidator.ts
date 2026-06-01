function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function validateScene(scene: unknown) {
  const errors: string[] = []

  if (!isRecord(scene)) {
    return {
      valid: false,
      errors: ['scene must be object'],
    }
  }

  if (!scene.scene) errors.push('scene is required')
  if (typeof scene.start !== 'number') errors.push('start must be number')
  if (typeof scene.duration !== 'number') errors.push('duration must be number')
  if (!scene.text) errors.push('text is required')
  if (!scene.highlight) errors.push('highlight is required')
  if (!scene.background) errors.push('background is required')
  if (!scene.position) errors.push('position is required')
  if (!scene.animation) errors.push('animation is required')

  if (!isRecord(scene.camera)) {
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

export function validateScenes(scenes: unknown[]) {
  return scenes.map((scene, index) => {
    const sceneName = isRecord(scene) && typeof scene.scene === 'string'
      ? scene.scene
      : 'unknown'

    return {
      index,
      scene: sceneName,
      ...validateScene(scene),
    }
  })
}
