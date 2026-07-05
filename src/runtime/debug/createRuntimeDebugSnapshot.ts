import type { RuntimeContext } from '../context'
import type { RuntimeDebugSnapshot } from './types'

export function createRuntimeDebugSnapshot(
  context: RuntimeContext,
  timeMs: number,
): RuntimeDebugSnapshot {
  const { services } = context
  const project = services.project.getProjectConfig()

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
      background: project.background,
    },
    fps: services.playback.getTimelineFPS(),
    duration: services.playback.getTimelineDuration(),
    frame: services.playback.timeMsToFrame(timeMs),
    timeMs,
    scene: services.scene.getCurrentSceneState(timeMs),
    subtitle: services.subtitle.getCurrentSubtitleState(timeMs),
    camera: services.camera.getCurrentCameraState(timeMs),
  }
}
