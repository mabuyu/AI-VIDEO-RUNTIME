import { getTimeline } from './timelineParser'

export function validateTimeline() {
  const timeline = getTimeline()
  const errors: string[] = []

  if (!timeline.fps) {
    errors.push('fps missing')
  }

  if (!timeline.duration) {
    errors.push('duration missing')
  }

  if (!timeline.tracks) {
    errors.push('tracks missing')
  }

  if (Array.isArray(timeline.tracks) && timeline.tracks.length === 0) {
    errors.push('tracks empty')
  }

  const validTypes = ['scene', 'subtitle', 'camera']

  timeline.tracks.forEach((track, index) => {
    if (!track.id) {
      errors.push(`track ${index}: id missing`)
    }

    if (!track.type) {
      errors.push(`track ${index}: type missing`)
    }

    if (!validTypes.includes(track.type)) {
      errors.push(`track ${track.id}: invalid type`)
    }

    if (!track.source) {
      errors.push(`track ${index}: source missing`)
    }

    if (typeof track.enabled !== 'boolean') {
      errors.push(`track ${index}: enabled must be boolean`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}