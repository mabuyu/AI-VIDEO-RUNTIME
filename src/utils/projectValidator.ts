import project from '../data/project.json'

interface ProjectData {
  title: string
  author: string
  version: string
  fps: number
  width: number
  height: number
  duration: number
  background: string
}

export function validateProject(): string[] {
  const errors: string[] = []
  const config = project as ProjectData

  if (!config.title) {
    errors.push('project: title missing')
  }

  if (!config.author) {
    errors.push('project: author missing')
  }

  if (!config.version) {
    errors.push('project: version missing')
  }

  if (config.fps <= 0) {
    errors.push('project: invalid fps')
  }

  if (config.width <= 0) {
    errors.push('project: invalid width')
  }

  if (config.height <= 0) {
    errors.push('project: invalid height')
  }

  if (config.duration <= 0) {
    errors.push('project: invalid duration')
  }

  if (!config.background) {
    errors.push('project: background missing')
  }

  return errors
}