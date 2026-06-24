import project from '../data/project.json'

export interface ProjectConfig {
  title: string
  author: string
  version: string
  fps: number
  width: number
  height: number
  duration: number
  background: string
}

export function getProjectConfig(): ProjectConfig {
  return project as ProjectConfig
}

export function getProjectTitle(): string {
  return getProjectConfig().title
}

export function getProjectResolution() {
  const config = getProjectConfig()

  return {
    width: config.width,
    height: config.height,
  }
}

export function getProjectDuration(): number {
  return getProjectConfig().duration
}