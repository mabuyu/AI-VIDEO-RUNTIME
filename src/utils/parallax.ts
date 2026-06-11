export function getParallaxOffset(
  cameraX: number,
  cameraY: number,
  depthFactor: number
) {
  return {
    x: cameraX * depthFactor,
    y: cameraY * depthFactor,
  }
}

export function getLayerScale(
  cameraScale: number,
  depthFactor: number
) {
  return 1 + (cameraScale - 1) * depthFactor
}