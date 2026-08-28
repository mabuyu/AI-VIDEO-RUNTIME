import type { ProductionJobDispatch, ProductionJobQueue } from './contracts'
import { materializeProductionJobDispatch } from './productionJobDispatchSnapshot'

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

/** Deterministic process-local reference queue. availableAt is data, not a timer. */
export function createInMemoryProductionJobQueue(
  initialDispatches: readonly ProductionJobDispatch[] = [],
): ProductionJobQueue {
  const messages = new Map<string, ProductionJobDispatch>()
  const readyDispatchIds: string[] = []
  const inFlightDispatchIds = new Set<string>()

  function storeDispatch(dispatch: ProductionJobDispatch): void {
    const snapshot = materializeProductionJobDispatch(dispatch)
    if (snapshot === null) {
      throw new TypeError('ProductionJobQueue rejected an invalid dispatch')
    }

    const existing = messages.get(snapshot.dispatchId)
    if (existing !== undefined) {
      if (!sameDispatch(existing, snapshot)) {
        throw new TypeError(
          'ProductionJobQueue rejected a conflicting deterministic dispatch',
        )
      }
      return
    }

    messages.set(snapshot.dispatchId, snapshot)
    readyDispatchIds.push(snapshot.dispatchId)
  }

  for (const dispatch of initialDispatches) storeDispatch(dispatch)

  return Object.freeze({
    async enqueue(dispatch: ProductionJobDispatch): Promise<void> {
      storeDispatch(dispatch)
    },

    async receive(): Promise<ProductionJobDispatch | null> {
      while (readyDispatchIds.length > 0) {
        const dispatchId = readyDispatchIds.shift()
        if (dispatchId === undefined) break

        const stored = messages.get(dispatchId)
        if (stored === undefined) continue

        inFlightDispatchIds.add(dispatchId)
        return materializeProductionJobDispatch(stored)
      }

      return null
    },

    async ack(dispatchId: string): Promise<boolean> {
      if (!inFlightDispatchIds.delete(dispatchId)) return false
      messages.delete(dispatchId)
      return true
    },

    async release(dispatchId: string): Promise<boolean> {
      if (!inFlightDispatchIds.delete(dispatchId)) return false
      if (!messages.has(dispatchId)) return false
      readyDispatchIds.push(dispatchId)
      return true
    },
  })
}
