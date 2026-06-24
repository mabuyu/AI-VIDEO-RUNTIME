export interface EffectPreset {
  blur: number
  glow: number
  noise: number
  vignette: number
  bloom: number
  brightness: number
  contrast: number
  saturation: number
}

export const effectPresets: Record<string, EffectPreset> = {
  cinematic: {
    blur: 1,
    glow: 1.2,
    noise: 0.15,
    vignette: 0.35,
    bloom: 0.8,
    brightness: 1.08,
    contrast: 1.18,
    saturation: 1.12,
  },

  dramatic: {
    blur: 3,
    glow: 2,
    noise: 0.35,
    vignette: 0.75,
    bloom: 1.1,
    brightness: 0.92,
    contrast: 1.45,
    saturation: 1.2,
  },

  clean: {
    blur: 0,
    glow: 0,
    noise: 0,
    vignette: 0,
    bloom: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
  },

  dream: {
    blur: 6,
    glow: 4,
    noise: 0.05,
    vignette: 0.2,
    bloom: 1.8,
    brightness: 1.18,
    contrast: 1.05,
    saturation: 1.35,
  },
}

export function getEffectPreset(presetName: string): EffectPreset {
  return effectPresets[presetName] ?? effectPresets.clean
}