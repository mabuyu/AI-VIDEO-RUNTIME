export type { VideoProvider } from './videoProvider'
export { consumeVideoReference } from './videoReferenceConsumer'
export type {
  ConsumedVideoReference,
  VideoReferenceConsumptionIssue,
  VideoReferenceConsumptionResult,
} from './videoReferenceConsumer'
export {
  generateVideoAndWait,
  VIDEO_GENERATION_MAX_POLLING_ATTEMPTS,
  VIDEO_GENERATION_POLLING_INTERVAL_MS,
} from './videoGenerationFlow'
export type { VideoGenerationWaitOptions } from './videoGenerationFlow'
export { SeedanceProvider, resolveSeedanceProviderConfig } from './seedanceProvider'
export type {
  SeedanceApiClient,
  SeedanceCredentials,
  SeedanceEnvironment,
  SeedanceProviderConfig,
} from './seedanceProvider'
export { KlingProvider, resolveKlingProviderConfig } from './klingProvider'
export type {
  KlingApiClient,
  KlingCredentials,
  KlingEnvironment,
  KlingProviderConfig,
} from './klingProvider'
export type {
  JsonPrimitive,
  JsonValue,
  VideoAspectRatio,
  VideoCameraMovement,
  VideoCameraPlan,
  VideoGenerationIssue,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
  VideoReference,
  VideoStylePlan,
  VideoTimelinePlan,
  VideoTimelineSegment,
} from './types'
