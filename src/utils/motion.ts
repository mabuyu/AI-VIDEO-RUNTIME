// 把一个数值限制在最小值和最大值之间
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// 缓动函数：让动画更自然
export function easeOutCubic(progress: number) {
  const safeProgress = clamp(progress, 0, 1)

  return 1 - Math.pow(1 - safeProgress, 3)
}

// 插值函数：把 progress 0~1 映射到任意数值范围
export function interpolate(
  progress: number,
  from: number,
  to: number
) {
  const safeProgress = clamp(progress, 0, 1)

  return from + (to - from) * safeProgress
}

// 线性插值：从 start 平滑过渡到 end
export function lerp(
  start: number,
  end: number,
  progress: number
) {
  const safeProgress = clamp(progress, 0, 1)

  return start + (end - start) * safeProgress
}

// 视差运动：让不同元素以不同距离进入画面
export function parallax(
  progress: number,
  distance: number
) {
  const eased = easeOutCubic(progress)

  return interpolate(eased, distance, 0)
}