import {
  getAIPlan,
  getAIStatus,
} from './aiParser'

export function isAIPlanReady(): boolean {
  return getAIStatus() === 'ready'
}

export function getGeneratedProjectName(): string {
  return getAIPlan().generatedProject
}

export function getGeneratedSceneCount(): number {
  return getAIPlan().generatedScenes
}

export function getGeneratedResourceCount(): number {
  return getAIPlan().generatedResources
}

export function getGeneratedSubtitleCount(): number {
  return getAIPlan().generatedSubtitles
}

export function getAISummary(): string {
  const plan = getAIPlan()

  return `${plan.generatedProject} | scenes: ${plan.generatedScenes} | resources: ${plan.generatedResources} | subtitles: ${plan.generatedSubtitles}`
}