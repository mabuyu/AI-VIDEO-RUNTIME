interface SceneStatusProps {
  scene: string
  state: string
  index: number
  sceneProgress: number
  globalProgress: number
  transitionProgress: number
  frame: number
  time: number
}

export default function SceneStatus({
  scene,
  state,
  index,
  sceneProgress,
  globalProgress,
  transitionProgress,
  frame,
  time,
}: SceneStatusProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        right: 20,
        color: '#00ffd0',
        fontSize: 12,
        lineHeight: 1.6,
        opacity: 0.85,
        textAlign: 'right',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div>scene: {scene}</div>
      <div>index: {index}</div>
      <div>state: {state}</div>
      <div>frame: {frame}</div>
      <div>time: {Math.floor(time)}ms</div>
      <div>scene progress: {sceneProgress.toFixed(2)}</div>
      <div>global progress: {globalProgress.toFixed(2)}</div>
      <div>transition: {transitionProgress.toFixed(2)}</div>
    </div>
  )
}