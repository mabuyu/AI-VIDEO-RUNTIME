import { createRuntimeReaders } from '../readers'
import { validateRuntimeData } from '../validation'
import type { CreateValidatedRuntimeReadersResult } from './types'

export function createValidatedRuntimeReaders(
  runtimeData: unknown,
): CreateValidatedRuntimeReadersResult {
  const validationResult = validateRuntimeData(runtimeData)

  if (!validationResult.ok) {
    return {
      ok: false,
      issues: validationResult.issues,
    }
  }

  return {
    ok: true,
    readers: createRuntimeReaders(validationResult.data),
    issues: validationResult.issues,
  }
}
