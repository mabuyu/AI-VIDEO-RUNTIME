import audio from '../../data/audio.json'
import camera from '../../data/camera.json'
import composition from '../../data/composition.json'
import depth from '../../data/depth.json'
import effect from '../../data/effect.json'
import project from '../../data/project.json'
import scenes from '../../data/scenes.json'
import subtitles from '../../data/subtitles.json'
import timeline from '../../data/timeline.json'
import type { GeneratedRuntimeDataV2Artifact } from '../loaders'
import type { RuntimeDataV2 } from '../types'

export const generatedRuntimeDataV2ArtifactFixture = {
  schemaVersion: '1',
  runtimeSchemaVersion: '2',
  source: { type: 'generated', id: 'generated-runtime-data-v2-fixture' },
  artifact: { id: 'generated-runtime-data-v2-fixture-artifact', revision: '1' },
  generation: {
    compilerVersion: 'fixture-compiler-1',
    promptContractVersion: '1',
    generatedAt: '2026-07-13T00:00:00.000Z',
  },
  runtimeData: {
    project, scenes, subtitles, timeline, camera, effect, depth, composition, audio,
  } as RuntimeDataV2,
} as const satisfies GeneratedRuntimeDataV2Artifact
