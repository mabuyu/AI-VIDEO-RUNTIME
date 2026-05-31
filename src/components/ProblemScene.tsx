import { easeOutCubic, interpolate } from '../utils/motion'

type ProblemSceneProps = {
  text: string
  highlight: string
  animation: string
  progress: number
}

function ProblemScene(props: ProblemSceneProps) {
  const parts = props.text.split(props.highlight)

  // 缓动后的进度，让运动更自然
  const easedProgress = easeOutCubic(props.progress)

  // 标签从左侧轻微滑入
  const labelX = interpolate(easedProgress, 0, 20)

  // 正文从下方进入
  const textY = interpolate(easedProgress, 30, 0)

  // 透明度逐渐提高
  const labelOpacity = interpolate(easedProgress, 0.5, 1)
  const textOpacity = interpolate(easedProgress, 0.4, 1)

  return (
    <div className={`problem-scene ${props.animation}`}>
      <div
        className="problem-label"
        style={{
          transform: `translateX(${labelX}px)`,
          opacity: labelOpacity,
        }}
      >
        问题
      </div>

      <div
        className="problem-text"
        style={{
          transform: `translateY(${textY}px)`,
          opacity: textOpacity,
        }}
      >
        {parts[0]}
        <span className="highlight">{props.highlight}</span>
        {parts[1]}
      </div>
    </div>
  )
}

export default ProblemScene