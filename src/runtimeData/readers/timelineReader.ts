import type { RuntimeDataV1 } from '../types'
import type { TimelineReader } from './types'

export function createTimelineReader(
  runtimeData: RuntimeDataV1,
): TimelineReader {
  return {
    getTimeline() {
      return runtimeData.timeline
    },
    getTimelineDuration() {
      return runtimeData.timeline.duration
    },
    getTimelineFPS() {
      return runtimeData.timeline.fps
    },
    getTimelineTracks() {
      return runtimeData.timeline.tracks
    },
    getEnabledTracks() {
      return runtimeData.timeline.tracks.filter((track) => track.enabled)
    },
    getTrackByType(type) {
      return runtimeData.timeline.tracks.find((track) => track.type === type) ?? null
    },
  }
}
