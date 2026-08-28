import type {
  ProductionJobOutboxDispatcher,
  ProductionJobOutboxDispatcherDependencies,
  ProductionJobOutboxDispatchResult,
} from './contracts'

export function createProductionJobOutboxDispatcher(
  dependencies: ProductionJobOutboxDispatcherDependencies,
): ProductionJobOutboxDispatcher {
  const { outbox, queue } = dependencies

  return Object.freeze({
    async dispatchPending(
      dispatchedAt: string,
    ): Promise<ProductionJobOutboxDispatchResult> {
      if (
        typeof dispatchedAt !== 'string' ||
        !Number.isFinite(Date.parse(dispatchedAt))
      ) {
        throw new TypeError('Outbox dispatch requires a valid dispatchedAt')
      }
      const pending = await outbox.listPending()
      let dispatchedCount = 0
      let failedCount = 0

      for (const entry of pending) {
        try {
          await queue.enqueue(entry.dispatch)
          const marked = await outbox.markDispatched(
            entry.outboxEntryId,
            dispatchedAt,
          )
          if (marked) dispatchedCount += 1
          else failedCount += 1
        } catch {
          failedCount += 1
        }
      }

      return Object.freeze({ dispatchedCount, failedCount })
    },
  })
}
