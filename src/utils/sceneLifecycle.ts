export function getSceneState(
  progress: number
) {
  if (progress < 0.15) {
    return 'enter'
  }

  if (progress > 0.85) {
    return 'exit'
  }

  return 'active'
}