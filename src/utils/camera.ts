export function cameraShake(
  time: number,
  amplitude = 1
) {
  const x =
    Math.sin(time * 0.003) *
    amplitude

  const y =
    Math.cos(time * 0.002) *
    amplitude

  return {
    x,
    y,
  }
}