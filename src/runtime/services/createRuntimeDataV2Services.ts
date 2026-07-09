import type { RuntimeDataV2Readers } from '../../runtimeData'
import { createAudioService } from './audio/audioService'
import { createCompositionService } from './composition/compositionService'
import { createDepthService } from './depth/depthService'
import { createEffectService } from './effect/effectService'
import { createRuntimeServices } from './createRuntimeServices'
import type { RuntimeDataV2Services } from './types'

export function createRuntimeDataV2Services(
  readers: RuntimeDataV2Readers,
): RuntimeDataV2Services {
  return {
    ...createRuntimeServices(readers),
    effect: createEffectService({ effectReader: readers.effect }),
    depth: createDepthService({ depthReader: readers.depth }),
    composition: createCompositionService({
      compositionReader: readers.composition,
    }),
    audio: createAudioService({ audioReader: readers.audio }),
  }
}
