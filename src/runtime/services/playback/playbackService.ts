import type { PlaybackService, PlaybackServiceDependencies } from '../types'

export function createPlaybackService({
  timelineReader,
}: PlaybackServiceDependencies): PlaybackService {
  return {
    getTimelineFPS() {
      return timelineReader.getTimelineFPS()
    },
    getTimelineDuration() {
      return timelineReader.getTimelineDuration()
    },
    getTotalFrames() {
      return Math.floor(
        (timelineReader.getTimelineDuration() / 1000) *
          timelineReader.getTimelineFPS(),
      )
    },
    frameToTimeMs(frame: number) {
      return (frame / timelineReader.getTimelineFPS()) * 1000
    },
    timeMsToFrame(timeMs: number) {
      return Math.floor((timeMs / 1000) * timelineReader.getTimelineFPS())
    },
  }
}
