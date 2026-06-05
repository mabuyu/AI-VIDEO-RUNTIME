import subtitles from '../data/subtitles.json'

export function validateSubtitles() {
  const errors: string[] = []

  subtitles.forEach((subtitle, index) => {
    if (!subtitle.id) {
      errors.push(
        `subtitle ${index}: id missing`
      )
    }

    if (!subtitle.text) {
      errors.push(
        `subtitle ${index}: text missing`
      )
    }

    if (typeof subtitle.start !== 'number') {
      errors.push(
        `subtitle ${index}: start invalid`
      )
    }

    if (
      typeof subtitle.duration !== 'number'
    ) {
      errors.push(
        `subtitle ${index}: duration invalid`
      )
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}