import type { StaticRuntimeDataSource } from './types'

export function createStaticRuntimeDataSource(): StaticRuntimeDataSource {
  return { kind: 'static' }
}
