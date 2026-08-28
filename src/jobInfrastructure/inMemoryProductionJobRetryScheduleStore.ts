import type {
  ProductionJobRetrySchedule,
  ProductionJobRetryScheduleStore,
} from './contracts'

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function snapshotSchedule(
  value: ProductionJobRetrySchedule,
): ProductionJobRetrySchedule | null {
  if (
    !isBoundaryString(value.jobId) ||
    !Number.isSafeInteger(value.jobVersion) ||
    value.jobVersion < 0 ||
    !isBoundaryString(value.availableAt) ||
    !Number.isFinite(Date.parse(value.availableAt))
  ) {
    return null
  }
  return Object.freeze({
    jobId: value.jobId,
    jobVersion: value.jobVersion,
    availableAt: value.availableAt,
  })
}

export function createInMemoryProductionJobRetryScheduleStore(): ProductionJobRetryScheduleStore {
  const schedules = new Map<string, ProductionJobRetrySchedule>()

  return Object.freeze({
    async save(schedule: ProductionJobRetrySchedule): Promise<boolean> {
      const snapshot = snapshotSchedule(schedule)
      if (snapshot === null) return false

      const existing = schedules.get(snapshot.jobId)
      if (existing !== undefined) {
        return (
          existing.jobVersion === snapshot.jobVersion &&
          existing.availableAt === snapshot.availableAt
        )
      }

      schedules.set(snapshot.jobId, snapshot)
      return true
    },

    async getByJobId(
      jobId: string,
    ): Promise<ProductionJobRetrySchedule | null> {
      const schedule = schedules.get(jobId)
      return schedule === undefined ? null : snapshotSchedule(schedule)
    },

    async remove(
      jobId: string,
      expectedJobVersion: number,
    ): Promise<boolean> {
      const schedule = schedules.get(jobId)
      if (
        schedule === undefined ||
        schedule.jobVersion !== expectedJobVersion
      ) {
        return false
      }
      schedules.delete(jobId)
      return true
    },
  })
}
