import depths from '../data/depth.json'

export interface Depth {
  id: string
  start: number
  duration: number
  preset: string
}

export function getDepths(): Depth[] {
  return depths as Depth[]
}

export function getCurrentDepth(
  currentTime: number
): Depth | null {
  const depth = getDepths().find(
    (depth) =>
      currentTime >= depth.start &&
      currentTime < depth.start + depth.duration
  )

  return depth || null
}

export function getDepthProgress(
  currentTime: number,
  depth: Depth | null
): number {
  if (!depth) return 0

  return Math.min(
    (currentTime - depth.start) / depth.duration,
    1
  )
}