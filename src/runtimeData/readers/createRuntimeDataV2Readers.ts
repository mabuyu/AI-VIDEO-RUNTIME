import type { RuntimeBootstrapV2 } from '../../runtime/bootstrap'
import { createRuntimeReaders } from './createRuntimeReaders'
import type {
  AudioReader,
  CompositionReader,
  DepthReader,
  EffectReader,
  RuntimeDataV2Readers,
} from './types'

function isActiveAt(
  item: { readonly start: number; readonly duration: number },
  timeMs: number,
): boolean {
  return timeMs >= item.start && timeMs < item.start + item.duration
}

export function createRuntimeDataV2Readers(
  bootstrap: RuntimeBootstrapV2,
): RuntimeDataV2Readers {
  const runtimeData = bootstrap.consumption.data
  const v1Readers = createRuntimeReaders(runtimeData)

  const effect: EffectReader = {
    getEffects: () => runtimeData.effect,
    getCurrentEffect: (timeMs) =>
      runtimeData.effect.find((item) => isActiveAt(item, timeMs)) ?? null,
  }
  const depth: DepthReader = {
    getDepthTracks: () => runtimeData.depth,
    getCurrentDepth: (timeMs) =>
      runtimeData.depth.find((item) => isActiveAt(item, timeMs)) ?? null,
  }
  const composition: CompositionReader = {
    getCompositions: () => runtimeData.composition,
    getCurrentComposition: (timeMs) =>
      runtimeData.composition.find((item) => isActiveAt(item, timeMs)) ?? null,
  }
  const audio: AudioReader = {
    getAudioTracks: () => runtimeData.audio,
    getCurrentAudio: (timeMs) =>
      runtimeData.audio.find((item) => isActiveAt(item, timeMs)) ?? null,
  }

  return {
    ...v1Readers,
    effect,
    depth,
    composition,
    audio,
  }
}
