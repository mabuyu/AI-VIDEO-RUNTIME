import type { ProviderAdapter } from '../contracts'

export interface ProviderRegistry {
  register(adapter: ProviderAdapter): void
  resolve(providerId: string): ProviderAdapter | undefined
  list(): readonly ProviderAdapter[]
}
