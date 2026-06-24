import ai from '../data/ai.json'

export interface AIPlan {
  prompt: string
  model: string
  status: 'ready' | 'draft' | 'error'
  generatedProject: string
  generatedScenes: number
  generatedResources: number
  generatedSubtitles: number
}

export function getAIPlan(): AIPlan {
  return ai as AIPlan
}

export function getAIPrompt(): string {
  return getAIPlan().prompt
}

export function getAIModel(): string {
  return getAIPlan().model
}

export function getAIStatus(): AIPlan['status'] {
  return getAIPlan().status
}