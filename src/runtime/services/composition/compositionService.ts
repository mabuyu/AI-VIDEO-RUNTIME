import { createTimedRuntimeState } from '../timedRuntimeState'
import type {
  CompositionService,
  CompositionServiceDependencies,
} from '../types'

export function createCompositionService({
  compositionReader,
}: CompositionServiceDependencies): CompositionService {
  return {
    getCompositions: () => compositionReader.getCompositions(),
    getCurrentComposition: (timeMs) =>
      compositionReader.getCurrentComposition(timeMs),
    getCurrentCompositionState: (timeMs) =>
      createTimedRuntimeState(
        compositionReader.getCurrentComposition(timeMs),
        timeMs,
      ),
  }
}
