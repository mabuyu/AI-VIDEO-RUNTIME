export const CAMERA_PRESETS = {
  dramaticZoom: {
    scaleFrom: 1,
    scaleTo: 1.4,
    xFrom: 0,
    xTo: 80,
    yFrom: 0,
    yTo: 40,
    shake: 4,
  },

  slowPush: {
    scaleFrom: 1,
    scaleTo: 1.15,
    xFrom: 0,
    xTo: 20,
    yFrom: 0,
    yTo: 0,
    shake: 0,
  },

  cinematicPan: {
    scaleFrom: 1.1,
    scaleTo: 1.1,
    xFrom: -100,
    xTo: 100,
    yFrom: 0,
    yTo: 0,
    shake: 0,
  },

  handheld: {
    scaleFrom: 1.05,
    scaleTo: 1.08,
    xFrom: 0,
    xTo: 10,
    yFrom: 0,
    yTo: 5,
    shake: 8,
  },
} as const

export function getCameraPreset(
  preset?: string
) {
  if (!preset) {
    return null
  }

  return CAMERA_PRESETS[
    preset as keyof typeof CAMERA_PRESETS
  ]
}