import type { RuntimeContextV2 } from '../context'
import type { RuntimeDebugSnapshotV2 } from './types'

export function createRuntimeDebugSnapshotV2(
  context: RuntimeContextV2,
): RuntimeDebugSnapshotV2 {
  const { bootstrap, readers, readiness, services, state } = context

  return {
    readiness: {
      ready: readiness.ready,
    },
    context: {
      status: state.status,
    },
    bootstrap: {
      ready: bootstrap.ready,
    },
    readers: {
      sceneCount: readers.scene.getScenes().length,
      subtitleCount: readers.subtitle.getSubtitles().length,
      timelineTrackCount: readers.timeline.getTimelineTracks().length,
      cameraCount: readers.camera.getCameras().length,
      effectCount: readers.effect.getEffects().length,
      depthCount: readers.depth.getDepthTracks().length,
      compositionCount: readers.composition.getCompositions().length,
      audioCount: readers.audio.getAudioTracks().length,
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
