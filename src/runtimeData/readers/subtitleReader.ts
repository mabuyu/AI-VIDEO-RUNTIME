import type { RuntimeDataV1 } from '../types'
import type { SubtitleReader } from './types'

export function createSubtitleReader(
  runtimeData: RuntimeDataV1,
): SubtitleReader {
  return {
    getSubtitles() {
      return runtimeData.subtitles
    },
    getCurrentSubtitle(timeMs: number) {
      return (
        runtimeData.subtitles.find(
          (subtitle) =>
            timeMs >= subtitle.start &&
            timeMs < subtitle.start + subtitle.duration,
        ) ?? null
      )
    },
  }
}
