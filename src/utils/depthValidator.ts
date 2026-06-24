import depths from '../data/depth.json'

interface DepthData {
  id: string
  start: number
  duration: number
  preset: string
}

export function validateDepths() {
  const errors: string[] = []

  ;(depths as DepthData[]).forEach(
    (depth, index) => {
      if (!depth.id) {
        errors.push(
          `depth ${index}: id missing`
        )
      }

      if (
        typeof depth.start !== 'number'
      ) {
        errors.push(
          `depth ${index}: start invalid`
        )
      }

      if (
        typeof depth.duration !==
        'number'
      ) {
        errors.push(
          `depth ${index}: duration invalid`
        )
      }

      if (
        typeof depth.preset !==
        'string'
      ) {
        errors.push(
          `depth ${index}: preset invalid`
        )
      }
    }
  )

  return {
    valid: errors.length === 0,
    errors,
  }
}