import audios from '../data/audio.json'

interface AudioData {
  id: string
  start: number
  duration: number
  preset: string
}

export function validateAudios() {
  const errors: string[] = []

  ;(audios as AudioData[]).forEach(
    (audio, index) => {
      if (!audio.id) {
        errors.push(
          `audio ${index}: id missing`
        )
      }

      if (
        typeof audio.start !== 'number'
      ) {
        errors.push(
          `audio ${index}: start invalid`
        )
      }

      if (
        typeof audio.duration !== 'number'
      ) {
        errors.push(
          `audio ${index}: duration invalid`
        )
      }

      if (
        typeof audio.preset !== 'string'
      ) {
        errors.push(
          `audio ${index}: preset invalid`
        )
      }
    }
  )

  return {
    valid: errors.length === 0,
    errors
  }
}