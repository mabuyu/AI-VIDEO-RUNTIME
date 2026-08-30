import {
  authorizeProject,
  isAuthorizedProject,
} from './authorityProvenance'
import type { Project, ProjectRecord, ProjectRepository } from './contracts'
import {
  isValidProjectRecord,
  repositoryFailure,
  repositorySuccess,
  validateCas,
} from './productRecordValidation'

function copyRecord(record: ProjectRecord): ProjectRecord {
  return {
    projectId: record.projectId,
    workspaceId: record.workspaceId,
    name: record.name,
    status: record.status,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function rehydrate(record: ProjectRecord): Project {
  if (!isValidProjectRecord(record)) {
    throw new TypeError('Stored ProjectRecord failed strict validation')
  }
  return authorizeProject(copyRecord(record))
}

export function createInMemoryProjectRepository(
  initialRecords: readonly ProjectRecord[] = [],
): ProjectRepository {
  const records = new Map<string, ProjectRecord>()
  for (const record of initialRecords) {
    if (!isValidProjectRecord(record) || records.has(record.projectId)) {
      throw new TypeError('Initial ProjectRecord is invalid or duplicated')
    }
    records.set(record.projectId, copyRecord(record))
  }

  return Object.freeze({
    save(project: Project, expectedVersion: number | null) {
      if (
        typeof project !== 'object' ||
        project === null ||
        !isAuthorizedProject(project)
      ) {
        return repositoryFailure(
          'INVALID_SNAPSHOT',
          'ProjectRepository accepts only trusted Project snapshots',
        )
      }
      const record = copyRecord(project)
      if (!isValidProjectRecord(record)) {
        return repositoryFailure(
          'INVALID_RECORD',
          'Project snapshot cannot produce a valid ProjectRecord',
        )
      }
      const current = records.get(record.projectId)
      const casFailure = validateCas(
        current?.version,
        record.version,
        expectedVersion,
      )
      if (casFailure !== undefined) return casFailure
      records.set(record.projectId, copyRecord(record))
      return repositorySuccess()
    },

    getById(projectId: string) {
      const record = records.get(projectId)
      return record === undefined ? undefined : rehydrate(copyRecord(record))
    },

    exists(projectId: string) {
      return records.has(projectId)
    },
  })
}
