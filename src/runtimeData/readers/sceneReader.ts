import type { RuntimeDataV1 } from '../types'
import type { RuntimeScene, SceneReader } from './types'

function clampProgress(progress: number): number {
  return Math.min(Math.max(progress, 0), 1)
}

function isActiveAt(
  item: { start: number; duration: number },
  timeMs: number,
): boolean {
  return timeMs >= item.start && timeMs < item.start + item.duration
}

export function createSceneReader(runtimeData: RuntimeDataV1): SceneReader {
  return {
    getScenes() {
      return runtimeData.scenes
    },
    getCurrentScene(timeMs: number) {
      return runtimeData.scenes.find((scene) => isActiveAt(scene, timeMs)) ?? null
    },
    getCurrentSceneIndex(timeMs: number) {
      return runtimeData.scenes.findIndex((scene) => isActiveAt(scene, timeMs))
    },
    getSceneProgress(timeMs: number, scene: RuntimeScene) {
      return clampProgress((timeMs - scene.start) / scene.duration)
    },
    getGlobalProgress(timeMs: number) {
      return clampProgress(timeMs / runtimeData.timeline.duration)
    },
  }
}
