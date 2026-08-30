import {
  authorizeWorkspaceMembership,
  isAuthorizedWorkspaceMembership,
} from './authorityProvenance'
import type {
  WorkspaceMembership,
  WorkspaceMembershipRecord,
  WorkspaceMembershipRepository,
} from './contracts'
import {
  isValidWorkspaceMembershipRecord,
  repositoryFailure,
  repositorySuccess,
  validateCas,
} from './productRecordValidation'
import { workspaceMembershipId } from './workspaceMembershipAuthority'

function copyRecord(
  record: WorkspaceMembershipRecord,
): WorkspaceMembershipRecord {
  return {
    membershipId: record.membershipId,
    workspaceId: record.workspaceId,
    userId: record.userId,
    role: record.role,
    status: record.status,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function rehydrate(record: WorkspaceMembershipRecord): WorkspaceMembership {
  if (!isValidWorkspaceMembershipRecord(record)) {
    throw new TypeError(
      'Stored WorkspaceMembershipRecord failed strict validation',
    )
  }
  return authorizeWorkspaceMembership(copyRecord(record))
}

export function createInMemoryWorkspaceMembershipRepository(
  initialRecords: readonly WorkspaceMembershipRecord[] = [],
): WorkspaceMembershipRepository {
  const records = new Map<string, WorkspaceMembershipRecord>()
  for (const record of initialRecords) {
    if (
      !isValidWorkspaceMembershipRecord(record) ||
      records.has(record.membershipId)
    ) {
      throw new TypeError(
        'Initial WorkspaceMembershipRecord is invalid or duplicated',
      )
    }
    records.set(record.membershipId, copyRecord(record))
  }

  return Object.freeze({
    save(membership: WorkspaceMembership, expectedVersion: number | null) {
      if (
        typeof membership !== 'object' ||
        membership === null ||
        !isAuthorizedWorkspaceMembership(membership)
      ) {
        return repositoryFailure(
          'INVALID_SNAPSHOT',
          'WorkspaceMembershipRepository accepts only trusted Membership snapshots',
        )
      }
      const record = copyRecord(membership)
      if (!isValidWorkspaceMembershipRecord(record)) {
        return repositoryFailure(
          'INVALID_RECORD',
          'Membership snapshot cannot produce a valid WorkspaceMembershipRecord',
        )
      }
      const current = records.get(record.membershipId)
      const casFailure = validateCas(
        current?.version,
        record.version,
        expectedVersion,
      )
      if (casFailure !== undefined) return casFailure
      records.set(record.membershipId, copyRecord(record))
      return repositorySuccess()
    },

    getById(membershipId: string) {
      const record = records.get(membershipId)
      return record === undefined ? undefined : rehydrate(copyRecord(record))
    },

    getByWorkspaceAndUser(workspaceId: string, userId: string) {
      const record = records.get(workspaceMembershipId(workspaceId, userId))
      return record === undefined ? undefined : rehydrate(copyRecord(record))
    },

    exists(membershipId: string) {
      return records.has(membershipId)
    },
  })
}
