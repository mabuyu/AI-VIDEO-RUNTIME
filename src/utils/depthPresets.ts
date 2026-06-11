export interface DepthPreset {
  foreground: number
  middle: number
  background: number
}

export const depthPresets: Record<
  string,
  DepthPreset
> = {
  near: {
    foreground: 1.4,
    middle: 1,
    background: 0.6,
  },

  balanced: {
    foreground: 1.2,
    middle: 1,
    background: 0.8,
  },

  deep: {
    foreground: 1.8,
    middle: 1,
    background: 0.4,
  },

  cinematic: {
    foreground: 2,
    middle: 1,
    background: 0.3,
  },
}

export function getDepthPreset(
  presetName: string
): DepthPreset {
  return (
    depthPresets[presetName] ??
    depthPresets.balanced
  )
}