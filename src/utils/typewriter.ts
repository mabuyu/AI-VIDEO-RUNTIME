/**
 * 打字机进度
 *
 * progress:
 * 0~1
 *
 * text:
 * 原始文本
 */

export function typewriter(
  text: string,
  progress: number
): string {
  const length = Math.floor(
    text.length * progress
  )

  return text.slice(0, length)
}