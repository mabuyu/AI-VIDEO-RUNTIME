import {
  createValidatedRuntimeReaders,
  resolveRuntimeDataSource,
} from '../../runtimeData'
import type { RuntimeDataSource } from '../../runtimeData'
import { createRuntimeServices } from '../services'
import type { RuntimeBootstrapResult } from './types'

export function createRuntimeBootstrap(
  source: RuntimeDataSource,
): RuntimeBootstrapResult {
  const runtimeData = resolveRuntimeDataSource(source)
  const readerResult = createValidatedRuntimeReaders(runtimeData)

  if (!readerResult.ok) {
    return {
      ok: false,
      sourceKind: source.kind,
      issues: readerResult.issues,
    }
  }

  const services = createRuntimeServices(readerResult.readers)

  return {
    ok: true,
    sourceKind: source.kind,
    readers: readerResult.readers,
    services,
    issues: readerResult.issues,
  }
}
