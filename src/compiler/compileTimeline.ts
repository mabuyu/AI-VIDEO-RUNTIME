import type { CompiledTimeline, CompilerInput } from './types'

export function compileTimeline(input: CompilerInput): CompiledTimeline {
  return {
    fps: input.project.fps,
    duration: input.project.duration,
    tracks: [
      {
        id: 'scene-track-main',
        type: 'scene',
        source: 'scenes.json',
        enabled: true,
      },
      {
        id: 'subtitle-track-main',
        type: 'subtitle',
        source: 'subtitles.json',
        enabled: true,
      },
      {
        id: 'camera-track-main',
        type: 'camera',
        source: 'camera.json',
        enabled: true,
      },
    ],
  }
}
