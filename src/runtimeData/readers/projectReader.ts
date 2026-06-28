import type { RuntimeDataV1 } from '../types'
import type { ProjectReader } from './types'

export function createProjectReader(
  runtimeData: RuntimeDataV1,
): ProjectReader {
  return {
    getProjectConfig() {
      return runtimeData.project
    },
    getProjectTitle() {
      return runtimeData.project.title
    },
    getProjectResolution() {
      return {
        width: runtimeData.project.width,
        height: runtimeData.project.height,
      }
    },
  }
}
