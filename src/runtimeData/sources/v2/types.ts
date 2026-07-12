import type { GeneratedRuntimeDataV2Artifact } from '../../loaders'

export interface StaticRuntimeDataV2Source {
  readonly type: 'static'
  readonly sourceId: string
  readonly revision: string
}

export interface GeneratedRuntimeDataV2Source {
  readonly type: 'generated'
  readonly artifactId: string
  readonly artifactRevision: string
  readonly artifact: GeneratedRuntimeDataV2Artifact
}

export interface RemoteRuntimeDataV2Source {
  readonly type: 'remote'
  readonly sourceId: string
  readonly revision: string
  readonly location: string
}

export type RuntimeDataSourceV2 =
  | StaticRuntimeDataV2Source
  | GeneratedRuntimeDataV2Source
  | RemoteRuntimeDataV2Source
