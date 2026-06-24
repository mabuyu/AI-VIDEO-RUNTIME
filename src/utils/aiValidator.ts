import ai from '../data/ai.json'

interface AIPlanData {
  prompt: string
  model: string
  status: string
  generatedProject: string
  generatedScenes: number
  generatedResources: number
  generatedSubtitles: number
}

export function validateAIPlan(): string[] {
  const errors: string[] = []

  const plan = ai as AIPlanData

  if (!plan.prompt) {
    errors.push('ai: prompt missing')
  }

  if (!plan.model) {
    errors.push('ai: model missing')
  }

  if (
    !['ready', 'draft', 'error'].includes(
      plan.status
    )
  ) {
    errors.push('ai: status invalid')
  }

  if (!plan.generatedProject) {
    errors.push('ai: generatedProject missing')
  }

  if (
    typeof plan.generatedScenes !== 'number'
  ) {
    errors.push('ai: generatedScenes invalid')
  }

  if (
    typeof plan.generatedResources !== 'number'
  ) {
    errors.push('ai: generatedResources invalid')
  }

  if (
    typeof plan.generatedSubtitles !== 'number'
  ) {
    errors.push('ai: generatedSubtitles invalid')
  }

  return errors
}