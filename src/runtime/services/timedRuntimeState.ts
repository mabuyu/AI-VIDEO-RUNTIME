import type { TimedRuntimeState } from './types'

export function createTimedRuntimeState<
  T extends { readonly start: number; readonly duration: number },
>(track: T | null, timeMs: number): TimedRuntimeState<T> {
  if (!track) {
    return {
      track: null,
      progress: 0,
      isActive: false,
    }
  }

  return {
    track,
    progress: Math.min(Math.max((timeMs - track.start) / track.duration, 0), 1),
    isActive: true,
  }
}
