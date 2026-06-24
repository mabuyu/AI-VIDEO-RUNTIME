import audios from '../data/audio.json'

export interface Audio {
  id: string
  start: number
  duration: number
  preset: string
}

export function getAudios(): Audio[] {
  return audios as Audio[]
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