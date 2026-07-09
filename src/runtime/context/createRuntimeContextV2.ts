import type {
  RuntimeContextV2,
  RuntimeContextV2Dependencies,
} from './types'

export function createRuntimeContextV2({
  bootstrap,
  readers,
  services,
}: RuntimeContextV2Dependencies): RuntimeContextV2 {
  return {
    readiness: {
      ready: bootstrap.ready,
    },
    services,
    state: {
      status: 'ready',
    },
    diagnostics: {
      bootstrapReady: bootstrap.ready,
      readerCounts: {
        scene: readers.scene.getScenes().length,
        subtitle: readers.subtitle.getSubtitles().length,
        timelineTrack: readers.timeline.getTimelineTracks().length,
        camera: readers.camera.getCameras().length,
        effect: readers.effect.getEffects().length,
        depth: readers.depth.getDepthTracks().length,
        composition: readers.composition.getCompositions().length,
        audio: readers.audio.getAudioTracks().length,
      },
    },
  }
}
