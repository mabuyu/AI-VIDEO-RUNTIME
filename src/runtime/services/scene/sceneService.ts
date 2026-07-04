import type {
  SceneLifecycleState,
  SceneRuntimeSnapshot,
  SceneService,
  SceneServiceDependencies,
} from '../types'

function getLifecycleFromProgress(progress: number): SceneLifecycleState {
  if (progress < 0.15) {
    return 'enter'
  }

  if (progress > 0.85) {
    return 'exit'
  }

  return 'active'
}

export function createSceneService({
  sceneReader,
}: SceneServiceDependencies): SceneService {
  function getCurrentSceneState(timeMs: number): SceneRuntimeSnapshot {
    const scene = sceneReader.getCurrentScene(timeMs)

    if (!scene) {
      return {
        scene: null,
        index: -1,
        progress: 0,
        lifecycle: 'inactive',
        isActive: false,
      }
    }

    const progress = sceneReader.getSceneProgress(timeMs, scene)

    return {
      scene,
      index: sceneReader.getCurrentSceneIndex(timeMs),
      progress,
      lifecycle: getLifecycleFromProgress(progress),
      isActive: true,
    }
  }

  return {
    getCurrentScene(timeMs: number) {
      return sceneReader.getCurrentScene(timeMs)
    },
    getCurrentSceneState,
    getSceneLifecycle(timeMs: number) {
      return getCurrentSceneState(timeMs).lifecycle
    },
  }
}
