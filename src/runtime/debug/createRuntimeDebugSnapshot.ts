import type { RuntimeContext } from '../context'
import type { RuntimeDebugSnapshot } from './types'

export function createRuntimeDebugSnapshot(
  context: RuntimeContext,
  timeMs: number,
): RuntimeDebugSnapshot {
  const { services } = context
  const project = services.project.getProjectConfig()
  const scene = services.scene.getCurrentSceneState(timeMs)

  return {
    sourceKind: context.sourceKind,
    validationWarnings: context.validationIssues.filter(
      (issue) => issue.severity === 'warning',
    ),
    project: {
      title: project.title,
      author: project.author,
      version: project.version,
      width: project.width,
      height: project.height,
      duration: project.duration,
      background: project.background,
    },
    fps: services.playback.getTimelineFPS(),
    duration: services.playback.getTimelineDuration(),
    frame: services.playback.timeMsToFrame(timeMs),
    timeMs,
    scene: {
      ...scene,
      globalProgress: services.scene.getGlobalProgress(timeMs),
    },
    subtitle: services.subtitle.getCurrentSubtitleState(timeMs),
    camera: services.camera.getCurrentCameraState(timeMs),
  }
}
