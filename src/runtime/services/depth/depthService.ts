import { createTimedRuntimeState } from '../timedRuntimeState'
import type { DepthService, DepthServiceDependencies } from '../types'

export function createDepthService({
  depthReader,
}: DepthServiceDependencies): DepthService {
  return {
    getDepthTracks: () => depthReader.getDepthTracks(),
    getCurrentDepth: (timeMs) => depthReader.getCurrentDepth(timeMs),
    getCurrentDepthState: (timeMs) =>
      createTimedRuntimeState(depthReader.getCurrentDepth(timeMs), timeMs),
  }
}
