import type {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderDurationCapability,
  ProviderMetadata,
  ProviderResolution,
  ProviderResolutionCapability,
} from '../contracts'
import type { ProviderRegistry } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value > 0
}

function isResolution(value: unknown): value is ProviderResolution {
  return (
    isRecord(value) &&
    isPositiveInteger(value.width) &&
    isPositiveInteger(value.height)
  )
}

function isResolutionCapability(
  value: unknown,
): value is ProviderResolutionCapability {
  return (
    isRecord(value) &&
    typeof value.supported === 'boolean' &&
    Array.isArray(value.values) &&
    value.values.every(isResolution) &&
    (value.supported || value.values.length === 0)
  )
}

function isDurationBound(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && value > 0)
}

function isDurationCapability(
  value: unknown,
): value is ProviderDurationCapability {
  if (
    !isRecord(value) ||
    typeof value.supported !== 'boolean' ||
    !isDurationBound(value.minSeconds) ||
    !isDurationBound(value.maxSeconds)
  ) {
    return false
  }

  if (!value.supported) {
    return value.minSeconds === null && value.maxSeconds === null
  }

  return (
    value.minSeconds !== null &&
    value.maxSeconds !== null &&
    value.minSeconds <= value.maxSeconds
  )
}

function isCapabilities(value: unknown): value is ProviderCapabilities {
  return (
    isRecord(value) &&
    typeof value.videoGeneration === 'boolean' &&
    typeof value.imageGeneration === 'boolean' &&
    isResolutionCapability(value.resolution) &&
    isDurationCapability(value.duration)
  )
}

function isMetadata(value: unknown): value is ProviderMetadata {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.version) &&
    isCapabilities(value.capabilities)
  )
}

function assertAdapter(adapter: ProviderAdapter): void {
  if (
    !isRecord(adapter) ||
    !isMetadata(adapter.metadata) ||
    typeof adapter.generate !== 'function' ||
    typeof adapter.getStatus !== 'function' ||
    typeof adapter.cancel !== 'function'
  ) {
    throw new TypeError('Provider Registry requires a valid Provider Adapter')
  }
}

export function createProviderRegistry(
  initialAdapters: readonly ProviderAdapter[] = [],
): ProviderRegistry {
  const adapters = new Map<string, ProviderAdapter>()

  const registry: ProviderRegistry = {
    register(adapter): void {
      assertAdapter(adapter)

      const providerId = adapter.metadata.id
      if (adapters.has(providerId)) {
        throw new Error(`Provider Adapter is already registered for ${providerId}`)
      }

      adapters.set(providerId, adapter)
    },

    resolve(providerId): ProviderAdapter | undefined {
      if (!isNonEmptyString(providerId)) {
        return undefined
      }

      return adapters.get(providerId)
    },

    list(): readonly ProviderAdapter[] {
      return Object.freeze(Array.from(adapters.values()))
    },
  }

  for (const adapter of initialAdapters) {
    registry.register(adapter)
  }

  return Object.freeze(registry)
}
