import type { ProjectService, ProjectServiceDependencies } from '../types'

export function createProjectService({
  projectReader,
}: ProjectServiceDependencies): ProjectService {
  return {
    getProjectConfig() {
      return projectReader.getProjectConfig()
    },
    getProjectTitle() {
      return projectReader.getProjectTitle()
    },
    getProjectResolution() {
      return projectReader.getProjectResolution()
    },
  }
}
