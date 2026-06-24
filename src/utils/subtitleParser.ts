import subtitles from '../data/subtitles.json'

export function getSubtitles() {
  return subtitles
}

export function getCurrentSubtitle(
  currentTime: number
) {
  return subtitles.find(
    (subtitle) =>
      currentTime >= subtitle.start &&
      currentTime <
        subtitle.start + subtitle.duration
  )
}