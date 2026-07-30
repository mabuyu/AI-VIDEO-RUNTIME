import type { ProviderCapabilities } from './providerCapability'

export interface ProviderMetadata<
  TCapabilities extends ProviderCapabilities = ProviderCapabilities,
> {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly capabilities: TCapabilities
}
