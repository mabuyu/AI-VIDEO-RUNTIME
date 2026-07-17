import type { VideoGenerationRequest, VideoGenerationResult } from './types'

export interface VideoProvider {
  readonly providerId: string
  generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult>
}
