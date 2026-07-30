import type { ProviderMetadata } from '../contracts'

export const MOCK_PROVIDER_METADATA: ProviderMetadata = Object.freeze({
  id: 'mock-provider',
  name: 'Internal Mock Provider',
  version: '1.0.0',
  capabilities: Object.freeze({
    videoGeneration: true,
    imageGeneration: false,
    resolution: Object.freeze({
      supported: true,
      values: Object.freeze([
        Object.freeze({ width: 1280, height: 720 }),
        Object.freeze({ width: 1920, height: 1080 }),
      ]),
    }),
    duration: Object.freeze({
      supported: true,
      minSeconds: 1,
      maxSeconds: 60,
    }),
  }),
})
