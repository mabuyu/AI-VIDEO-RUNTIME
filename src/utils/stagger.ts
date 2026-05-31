export function staggerProgress(
  progress: number,
  start: number,
  end: number
) {
  if (progress <= start) return 0

  if (progress >= end) return 1

  return (
    (progress - start) /
    (end - start)
  )
}