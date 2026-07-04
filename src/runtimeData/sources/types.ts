import type { RuntimeDataV1 } from '../types'

export type RuntimeDataSourceKind = 'static' | 'generated'

export interface StaticRuntimeDataSource {
  readonly kind: 'static'
}

export interface GeneratedRuntimeDataSource {
  readonly kind: 'generated'
  readonly data: RuntimeDataV1
}

export type RuntimeDataSource =
  | StaticRuntimeDataSource
  | GeneratedRuntimeDataSource
