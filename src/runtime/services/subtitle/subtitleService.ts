import type {
  SubtitleRuntimeState,
  SubtitleService,
  SubtitleServiceDependencies,
} from '../types'

export function createSubtitleService({
  subtitleReader,
}: SubtitleServiceDependencies): SubtitleService {
  function getCurrentSubtitleState(timeMs: number): SubtitleRuntimeState {
    const subtitle = subtitleReader.getCurrentSubtitle(timeMs)

    return {
      subtitle,
      isVisible: subtitle !== null,
    }
  }

  return {
    getCurrentSubtitle(timeMs: number) {
      return subtitleReader.getCurrentSubtitle(timeMs)
    },
    getCurrentSubtitleState,
    isSubtitleVisible(timeMs: number) {
      return getCurrentSubtitleState(timeMs).isVisible
    },
  }
}
