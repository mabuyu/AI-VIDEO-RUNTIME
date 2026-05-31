export function getTransitionProgress(
  progress: number,
  start: number,
  end: number
) {
  if (progress <= start) return 0
  if (progress >= end) return 1

  return (progress - start) / (end - start)
}

export function getExitStyle(progress: number) {
  return {
    opacity: 1 - progress,
    filter: `blur(${progress * 18}px)`,
    transform: `scale(${1 - progress * 0.04})`,
  }
}
export function getEnterStyle(progress: number) {
  return {
    opacity: progress,
    filter: `blur(${(1 - progress) * 12}px)`,
    transform: `
      scale(${0.9 + progress * 0.1})
      translateY(${(1 - progress) * 30}px)
    `,
  }
}