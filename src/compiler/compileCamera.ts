import type { CompiledCameraTrack, SemanticScene } from './types'

export function compileCamera(scenes: SemanticScene[]): CompiledCameraTrack[] {
  return scenes.map((scene, index) => {
    return {
      id: `camera-track-${index + 1}`,
      start: scene.start,
      duration: scene.duration,
      scaleFrom: scene.camera.scaleFrom,
      scaleTo: scene.camera.scaleTo,
      xFrom: scene.camera.xFrom,
      xTo: scene.camera.xTo,
      yFrom: scene.camera.yFrom,
      yTo: scene.camera.yTo,
      shake: scene.camera.shake,
    }
  })
}
