export interface ProviderResolution {
  readonly width: number
  readonly height: number
}

export interface ProviderResolutionCapability {
  readonly supported: boolean
  readonly values: readonly ProviderResolution[]
}

export interface ProviderDurationCapability {
  readonly supported: boolean
  readonly minSeconds: number | null
  readonly maxSeconds: number | null
}

export interface ProviderCapabilities {
  readonly videoGeneration: boolean
  readonly imageGeneration: boolean
  readonly resolution: ProviderResolutionCapability
  readonly duration: ProviderDurationCapability
}
