import {
  easeOutCubic,
  interpolate,
} from '../utils/motion'

import { staggerProgress } from '../utils/stagger'

type ContrastSceneProps = {
  text: string
  highlight: string
  animation: string
  progress: number
}

function ContrastScene(props: ContrastSceneProps) {
  const beforeProgress = staggerProgress(props.progress, 0, 0.45)
  const afterProgress = staggerProgress(props.progress, 0.35, 0.85)

  const easedBefore = easeOutCubic(beforeProgress)
  const easedAfter = easeOutCubic(afterProgress)

  const beforeX = interpolate(easedBefore, -40, 0)
  const afterX = interpolate(easedAfter, 40, 0)

  const beforeOpacity = interpolate(easedBefore, 0, 1)
  const afterOpacity = interpolate(easedAfter, 0, 1)

  return (
    <div className={`contrast-scene ${props.animation}`}>
      {/* Before */}
      <div
        className="contrast-column before"
        style={{
          opacity: beforeOpacity,
          transform: `translateX(${beforeX}px)`,
        }}
      >
        <div className="contrast-label">Before</div>
        <div className="contrast-title">传统剪辑</div>
        <div className="contrast-desc">手动剪辑 / 人工调节 / 低效率</div>
      </div>

      {/* VS */}
      <div className="contrast-vs">VS</div>

      {/* After */}
      <div
        className="contrast-column after"
        style={{
          opacity: afterOpacity,
          transform: `translateX(${afterX}px)`,
        }}
      >
        <div className="contrast-label">After</div>
        <div className="contrast-title">AI重构</div>
        <div className="contrast-desc">自动生成 / 程序化控制 / 高效率</div>
      </div>
    </div>
  )
}

export default ContrastScene