import {
  easeOutCubic,
  interpolate,
} from '../utils/motion'

import { getWordFocusProgress } from '../utils/wordFocus'

type HookSceneProps = {
  text: string
  highlight: string
  animation: string
  progress: number
}

function HookScene(props: HookSceneProps) {
  const aiProgress = getWordFocusProgress(props.progress, 0, 0.22)
  const actionProgress = getWordFocusProgress(props.progress, 0.18, 0.55)
  const objectProgress = getWordFocusProgress(props.progress, 0.45, 0.85)

  const easedAi = easeOutCubic(aiProgress)
  const easedAction = easeOutCubic(actionProgress)
  const easedObject = easeOutCubic(objectProgress)

  const aiScale = interpolate(easedAi, 1.4, 1)
  const aiOpacity = interpolate(easedAi, 0, 1)

  const actionY = interpolate(easedAction, 28, 0)
  const actionOpacity = interpolate(easedAction, 0, 1)

  const objectY = interpolate(easedObject, 28, 0)
  const objectOpacity = interpolate(easedObject, 0, 1)

  return (
    <div className={`hook-scene ${props.animation}`}>
      <div className="glow glow-one"></div>
      <div className="glow glow-two"></div>

      <div className="hook-final">
        <div
          className="hook-final-ai"
          style={{
            opacity: aiOpacity,
            transform: `scale(${aiScale})`,
          }}
        >
          AI
        </div>

        <div
          className="hook-final-action"
          style={{
            opacity: actionOpacity,
            transform: `translateY(${actionY}px)`,
          }}
        >
          正在改变
        </div>

        <div
          className="hook-final-object"
          style={{
            opacity: objectOpacity,
            transform: `translateY(${objectY}px)`,
          }}
        >
          视频行业
        </div>
      </div>
    </div>
  )
}

export default HookScene