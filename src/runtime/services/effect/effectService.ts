import { createTimedRuntimeState } from '../timedRuntimeState'
import type { EffectService, EffectServiceDependencies } from '../types'

export function createEffectService({
  effectReader,
}: EffectServiceDependencies): EffectService {
  return {
    getEffects: () => effectReader.getEffects(),
    getCurrentEffect: (timeMs) => effectReader.getCurrentEffect(timeMs),
    getCurrentEffectState: (timeMs) =>
      createTimedRuntimeState(effectReader.getCurrentEffect(timeMs), timeMs),
  }
}
