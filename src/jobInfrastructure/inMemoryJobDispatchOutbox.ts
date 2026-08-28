import type { ProductionJobDispatch } from '../queue'
import { materializeProductionJobDispatch } from '../queue/productionJobDispatchSnapshot'
import type {
  JobDispatchOutbox,
  JobDispatchOutboxEntry,
  JobDispatchOutboxEntryId,
} from './contracts'

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    Number.isFinite(Date.parse(value))
  )
}

function snapshotEntry(
  entry: JobDispatchOutboxEntry,
): JobDispatchOutboxEntry {
  const dispatch = materializeProductionJobDispatch(entry.dispatch)
  if (dispatch === null) {
    throw new TypeError('JobDispatchOutbox contains an invalid dispatch')
  }
  return Object.freeze({
    outboxEntryId: entry.outboxEntryId,
    dispatch,
    status: entry.status,
    createdAt: entry.createdAt,
    dispatchedAt: entry.dispatchedAt,
  })
}

function sameDispatch(
  left: ProductionJobDispatch,
  right: ProductionJobDispatch,
): boolean {
  return (
    left.dispatchId === right.dispatchId &&
    left.jobId === right.jobId &&
    left.expectedVersion === right.expectedVersion &&
    left.availableAt === right.availableAt
  )
}

export function createInMemoryJobDispatchOutbox(): JobDispatchOutbox {
  const entries = new Map<string, JobDispatchOutboxEntry>()

  return Object.freeze({
    async append(
      dispatchCandidate: ProductionJobDispatch,
      createdAt: string,
    ): Promise<JobDispatchOutboxEntry> {
      const dispatch = materializeProductionJobDispatch(dispatchCandidate)
      if (dispatch === null || !isTimestamp(createdAt)) {
        throw new TypeError('JobDispatchOutbox append input is invalid')
      }

      const outboxEntryId: JobDispatchOutboxEntryId =
        `job-dispatch-outbox:${dispatch.dispatchId}`
      const existing = entries.get(outboxEntryId)
      if (existing !== undefined) {
        if (
          !sameDispatch(existing.dispatch, dispatch) ||
          existing.createdAt !== createdAt
        ) {
          throw new TypeError(
            'JobDispatchOutbox rejected a conflicting deterministic entry',
          )
        }
        return snapshotEntry(existing)
      }

      const entry: JobDispatchOutboxEntry = Object.freeze({
        outboxEntryId,
        dispatch,
        status: 'PENDING',
        createdAt,
        dispatchedAt: null,
      })
      entries.set(outboxEntryId, entry)
      return snapshotEntry(entry)
    },

    async listPending(): Promise<readonly JobDispatchOutboxEntry[]> {
      return Object.freeze(
        Array.from(entries.values())
          .filter((entry) => entry.status === 'PENDING')
          .map(snapshotEntry),
      )
    },

    async markDispatched(
      outboxEntryId: string,
      dispatchedAt: string,
    ): Promise<boolean> {
      const current = entries.get(outboxEntryId)
      if (
        current === undefined ||
        !isTimestamp(dispatchedAt) ||
        Date.parse(dispatchedAt) < Date.parse(current.createdAt)
      ) {
        return false
      }
      if (current.status === 'DISPATCHED') return true

      entries.set(
        outboxEntryId,
        Object.freeze({
          ...current,
          status: 'DISPATCHED',
          dispatchedAt,
        }),
      )
      return true
    },
  })
}
