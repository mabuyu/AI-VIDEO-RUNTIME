import compositions from '../data/composition.json'

interface CompositionData {
  id: string
  start: number
  duration: number
  preset: string
}

export function validateCompositions() {
  const errors: string[] = []

  ;(compositions as CompositionData[]).forEach(
    (composition, index) => {
      if (!composition.id) {
        errors.push(
          `composition ${index}: id missing`
        )
      }

      if (
        typeof composition.start !== 'number'
      ) {
        errors.push(
          `composition ${index}: start invalid`
        )
      }

      if (
        typeof composition.duration !==
        'number'
      ) {
        errors.push(
          `composition ${index}: duration invalid`
        )
      }

      if (
        typeof composition.preset !==
        'string'
      ) {
        errors.push(
          `composition ${index}: preset invalid`
        )
      }
    }
  )

  return {
    valid: errors.length === 0,
    errors,
  }
}