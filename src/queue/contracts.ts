export type ProductionJobDispatchId =
  `production-job-dispatch:${string}:${number}`

export interface ProductionJobDispatch {
  readonly dispatchId: ProductionJobDispatchId
  readonly jobId: string
  readonly expectedVersion: number
  readonly availableAt: string
}

export interface ProductionJobQueue {
  readonly enqueue: (dispatch: ProductionJobDispatch) => Promise<void>
  readonly receive: () => Promise<ProductionJobDispatch | null>
  readonly ack: (dispatchId: string) => Promise<boolean>
  readonly release: (dispatchId: string) => Promise<boolean>
}
