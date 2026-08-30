import {
  authorizeWorkspace,
  isAuthorizedWorkspace,
} from './authorityProvenance'
import type {
  Workspace,
  WorkspaceRecord,
  WorkspaceRepository,
} from './contracts'
import {
  isValidWorkspaceRecord,
  repositoryFailure,
  repositorySuccess,
  validateCas,
} from './productRecordValidation'

function copyRecord(record: WorkspaceRecord): WorkspaceRecord {
  return {
    workspaceId: record.workspaceId,
    ownerUserId: record.ownerUserId,
    name: record.name,
    status: record.status,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function rehydrate(record: WorkspaceRecord): Workspace {
  if (!isValidWorkspaceRecord(record)) {
    throw new TypeError('Stored WorkspaceRecord failed strict validation')
  }
  return authorizeWorkspace(copyRecord(record))
}

export function createInMemoryWorkspaceRepository(
  initialRecords: readonly WorkspaceRecord[] = [],
): WorkspaceRepository {
  const records = new Map<string, WorkspaceRecord>()
  for (const record of initialRecords) {
    if (!isValidWorkspaceRecord(record) || records.has(record.workspaceId)) {
      throw new TypeError('Initial WorkspaceRecord is invalid or duplicated')
    }
    records.set(record.workspaceId, copyRecord(record))
  }

  return Object.freeze({
    save(workspace: Workspace, expectedVersion: number | null) {
      if (
        typeof workspace !== 'object' ||
        workspace === null ||
        !isAuthorizedWorkspace(workspace)
      ) {
        return repositoryFailure(
          'INVALID_SNAPSHOT',
          'WorkspaceRepository accepts only trusted Workspace snapshots',
        )
      }
      const record = copyRecord(workspace)
      if (!isValidWorkspaceRecord(record)) {
        return repositoryFailure(
          'INVALID_RECORD',
          'Workspace snapshot cannot produce a valid WorkspaceRecord',
        )
      }
      const current = records.get(record.workspaceId)
      const casFailure = validateCas(
        current?.version,
        record.version,
        expectedVersion,
      )
      if (casFailure !== undefined) return casFailure
      records.set(record.workspaceId, copyRecord(record))
      return repositorySuccess()
    },

    getById(workspaceId: string) {
      const record = records.get(workspaceId)
      return record === undefined ? undefined : rehydrate(copyRecord(record))
    },

    exists(workspaceId: string) {
      return records.has(workspaceId)
    },
  })
}
