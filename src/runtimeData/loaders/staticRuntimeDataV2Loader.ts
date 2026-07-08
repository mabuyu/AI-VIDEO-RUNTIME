import audio from '../../data/audio.json'
import camera from '../../data/camera.json'
import composition from '../../data/composition.json'
import depth from '../../data/depth.json'
import effect from '../../data/effect.json'
import project from '../../data/project.json'
import scenes from '../../data/scenes.json'
import subtitles from '../../data/subtitles.json'
import timeline from '../../data/timeline.json'
import type { RuntimeDataV2 } from '../types'

export function loadStaticRuntimeDataV2(): RuntimeDataV2 {
  return {
    project: project as RuntimeDataV2['project'],
    scenes: scenes as RuntimeDataV2['scenes'],
    subtitles: subtitles as RuntimeDataV2['subtitles'],
    timeline: timeline as RuntimeDataV2['timeline'],
    camera: camera as RuntimeDataV2['camera'],
    effect: effect as RuntimeDataV2['effect'],
    depth: depth as RuntimeDataV2['depth'],
    composition: composition as RuntimeDataV2['composition'],
    audio: audio as RuntimeDataV2['audio'],
  }
}
