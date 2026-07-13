import audios from '../data/audio.json'
import { validateAudio } from '../runtimeData/validation/validateAudio'

export function validateAudios() {
  const errors = validateAudio(audios).map(
    (issue) => `${issue.path}: ${issue.message}`,
  )

  return {
    valid: errors.length === 0,
    errors
  }
}
