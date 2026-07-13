import audios from '../data/audio.json'
import type { RuntimeAudioTrack } from '../runtimeData/types'

export type Audio = RuntimeAudioTrack

export function getAudios(): readonly Audio[] {
  return audios as RuntimeAudioTrack[]
}

export function getCurrentAudio(
  currentTime: number
): Audio | null {
  const audio = getAudios().find(
    (audio) =>
      currentTime >= audio.start &&
      currentTime < audio.start + audio.duration
  )

  return audio || null
}

export function getAudioProgress(
  currentTime: number,
  audio: Audio | null
): number {
  if (!audio) return 0

  return Math.min(
    (currentTime - audio.start) /
      audio.duration,
    1
  )
}
