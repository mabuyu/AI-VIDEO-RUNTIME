export function getParallaxOffset(
  cameraX: number,
  cameraY: number,
  depth: number
) {
  return {
    x: cameraX * depth,
    y: cameraY * depth,
  }
}