import { createTimedRuntimeState } from '../timedRuntimeState'
import type { AudioService, AudioServiceDependencies } from '../types'

export function createAudioService({
  audioReader,
}: AudioServiceDependencies): AudioService {
  return {
    getAudioTracks: () => audioReader.getAudioTracks(),
    getCurrentAudio: (timeMs) => audioReader.getCurrentAudio(timeMs),
    getCurrentAudioState: (timeMs) =>
      createTimedRuntimeState(audioReader.getCurrentAudio(timeMs), timeMs),
  }
}
