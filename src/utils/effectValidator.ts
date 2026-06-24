import effects from '../data/effect.json'
import type { Effect } from './effectParser'

export function validateEffects() {
  const errors: string[] = []

  effects.forEach((effect: Effect, index: number) => {
    if (!effect.id) {
      errors.push(`effect ${index}: id missing`)
    }

    if (typeof effect.start !== 'number') {
      errors.push(`effect ${index}: start invalid`)
    }

    if (typeof effect.duration !== 'number') {
      errors.push(`effect ${index}: duration invalid`)
    }

    if (typeof effect.preset !== 'string') {
      errors.push(`effect ${index}: preset invalid`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}