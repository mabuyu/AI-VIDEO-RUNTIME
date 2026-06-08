export interface AudioPreset {
  volume: number
  fadeIn: number
  fadeOut: number
}

export const audioPresets: Record<
  string,
  AudioPreset
> = {
  impact: {
    volume: 1.2,
    fadeIn: 0.1,
    fadeOut: 0.2
  },

  dramatic: {
    volume: 1.0,
    fadeIn: 0.3,
    fadeOut: 0.4
  },

  clean: {
    volume: 0.8,
    fadeIn: 0,
    fadeOut: 0
  },

  cinematic: {
    volume: 1.1,
    fadeIn: 0.5,
    fadeOut: 0.5
  }
}

export function getAudioPreset(
  presetName: string
): AudioPreset {
  return (
    audioPresets[presetName] ??
    audioPresets.clean
  )
}