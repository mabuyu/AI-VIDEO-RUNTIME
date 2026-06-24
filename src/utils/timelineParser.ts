import timeline from '../data/timeline.json'

export interface TimelineTrack {
  id: string
  type: string
  source: string
  enabled: boolean
}

export interface Timeline {
  fps: number
  duration: number
  tracks: TimelineTrack[]
}

const runtimeTimeline = timeline as Timeline

export function getTimeline() {
  return runtimeTimeline
}

export function getTimelineDuration() {
  return runtimeTimeline.duration
}

export function getTimelineFPS() {
  return runtimeTimeline.fps
}

export function getTimelineTracks() {
  return runtimeTimeline.tracks
}

export function getEnabledTracks() {
  return runtimeTimeline.tracks.filter((track) => track.enabled)
}

export function getTrackByType(type: string) {
  return runtimeTimeline.tracks.find((track) => track.type === type)
}