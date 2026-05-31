import {
  easeOutCubic,
  interpolate,
  parallax
} from '../utils/motion'

import { staggerProgress } from '../utils/stagger'

type ValueSceneProps = {
  text: string
  highlight: string
  animation: string
  progress: number
}

function ValueScene(props: ValueSceneProps) {
  const parts = props.text.split(props.highlight)

  // 分层进度：让不同元素按时间顺序入场
  const labelProgress = staggerProgress(props.progress, 0, 0.25)
  const titleProgress = staggerProgress(props.progress, 0.18, 0.65)
  const lineProgress = staggerProgress(props.progress, 0.55, 0.9)

  // 每一层单独缓动
  const easedLabel = easeOutCubic(labelProgress)
  const easedTitle = easeOutCubic(titleProgress)
  const easedLine = easeOutCubic(lineProgress)

  // 标签运动
  const labelY = interpolate(easedLabel, 25, 0)
  const labelOpacity = interpolate(easedLabel, 0, 1)

  // 标题运动：斜向推进
  const titleX = parallax(titleProgress, -20)
  const titleY = parallax(titleProgress, 60)
  const titleScale = interpolate(easedTitle, 0.92, 1)
  const titleOpacity = interpolate(easedTitle, 0, 1)

  // 下划线运动
  const lineY = interpolate(easedLine, 10, 0)
  const lineWidth = interpolate(easedLine, 0, 220)
  const lineOpacity = interpolate(easedLine, 0, 1)

  return (
    <div className={`value-scene ${props.animation}`}>
      {/* 第一层：标签先入场 */}
      <div
        className="value-label"
        style={{
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        价值
      </div>

      {/* 第二层：标题后入场 */}
      <div
        className="value-text"
        style={{
          opacity: titleOpacity,
          transform: `
            translateX(${titleX}px)
            translateY(${titleY}px)
            scale(${titleScale})
          `,
        }}
      >
        {parts[0]}
        <span className="highlight">
          {props.highlight}
        </span>
        {parts[1]}
      </div>

      {/* 第三层：强调线最后展开 */}
      <div
        className="value-line"
        style={{
          opacity: lineOpacity,
          width: `${lineWidth}px`,
          transform: `translateY(${lineY}px)`,
        }}
      ></div>
    </div>
  )
}

export default ValueScene