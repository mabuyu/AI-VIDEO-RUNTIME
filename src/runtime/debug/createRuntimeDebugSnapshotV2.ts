import type { RuntimeContextV2 } from '../context'
import type { RuntimeDebugSnapshotV2 } from './types'

export function createRuntimeDebugSnapshotV2(
  context: RuntimeContextV2,
): RuntimeDebugSnapshotV2 {
  const { diagnostics, readiness, services, state } = context

  return {
    readiness: {
      ready: readiness.ready,
    },
    context: {
      status: state.status,
    },
    bootstrap: {
      ready: diagnostics.bootstrapReady,
    },
    readers: {
      sceneCount: diagnostics.readerCounts.scene,
      subtitleCount: diagnostics.readerCounts.subtitle,
      timelineTrackCount: diagnostics.readerCounts.timelineTrack,
      cameraCount: diagnostics.readerCounts.camera,
      effectCount: diagnostics.readerCounts.effect,
      depthCount: diagnostics.readerCounts.depth,
      compositionCount: diagnostics.readerCounts.composition,
      audioCount: diagnostics.readerCounts.audio,
    },
    services: {
      projectTitle: services.project.getProjectTitle(),
      fps: services.playback.getTimelineFPS(),
      duration: services.playback.getTimelineDuration(),
      totalFrames: services.playback.getTotalFrames(),
      domainCount: Object.keys(services).length,
    },
  }
}
