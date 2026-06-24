    import effects from '../data/effect.json'

export interface Effect {
  id: string
  start: number
  duration: number
  preset: string
}

export function getEffects(): Effect[] {
  return effects as Effect[]
}

export function getCurrentEffect(
  currentTime: number
): Effect | null {
  const effect = getEffects().find(
    (effect) =>
      currentTime >= effect.start &&
      currentTime < effect.start + effect.duration
  )

  return effect || null
}

export function getEffectProgress(
  currentTime: number,
  effect: Effect | null
): number {
  if (!effect) return 0

  return Math.min(
    (currentTime - effect.start) /
      effect.duration,
    1
  )
}