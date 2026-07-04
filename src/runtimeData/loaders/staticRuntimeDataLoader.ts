import camera from '../../data/camera.json'
import project from '../../data/project.json'
import scenes from '../../data/scenes.json'
import subtitles from '../../data/subtitles.json'
import timeline from '../../data/timeline.json'
import type { RuntimeDataV1 } from '../types'

export function loadStaticRuntimeData(): RuntimeDataV1 {
  return {
    project: project as RuntimeDataV1['project'],
    scenes: scenes as RuntimeDataV1['scenes'],
    subtitles: subtitles as RuntimeDataV1['subtitles'],
    timeline: timeline as RuntimeDataV1['timeline'],
    camera: camera as RuntimeDataV1['camera'],
  }
}
