import DepthLayer from './components/DepthLayer'
import SceneTransition from './components/SceneTransition'
import SceneStatus from "./components/SceneStatus"

import { easeOutCubic, interpolate } from './utils/motion'
import { cameraShake } from './utils/camera'
import { getTransitionProgress, getExitStyle, getEnterStyle,} from './utils/transition'
import { renderSceneByType } from './utils/sceneRenderer'
import { getSceneState } from './utils/sceneLifecycle'
import './App.css'

import { useEffect, useState } from 'react'

function App() {
  const FPS = 30

  const scenes = [
    {
      scene: 'hook',
      start: 0,
      duration: 1200,
      text: 'AI正在改变视频行业',
      highlight: 'AI',
      background: 'linear-gradient(135deg, #111, #2b2b2b)',
      position: 'center',
      animation: 'pop',
      camera: {
        scaleFrom: 1,
        scaleTo: 1.04,
        xFrom: -8,
        xTo: 0,
        yFrom: 8,
        yTo: 0,
        shake: 0.4,
      },
    },
    {
      scene: 'problem',
      start: 1200,
      duration: 1500,
      text: '未来的视频将由AI生成',
      highlight: 'AI',
      background: 'linear-gradient(135deg, #111, #1b263b)',
      position: 'top',
      animation: 'slide',
      camera: {
        scaleFrom: 1,
        scaleTo: 1.05,
        xFrom: 10,
        xTo: 0,
        yFrom: 12,
        yTo: 0,
        shake: 0.6,
      },
    },
    {
      scene: 'value',
      start: 2700,
      duration: 1500,
      text: '程序化视频是未来',
      highlight: '程序化视频',
      background: 'linear-gradient(135deg, #111, #2d1b3d)',
      position: 'center',
      animation: 'zoom',
      camera: {
        scaleFrom: 1,
        scaleTo: 1.06,
        xFrom: -12,
        xTo: 0,
        yFrom: 10,
        yTo: 0,
        shake: 0.5,
      },
    },
    {
      scene: 'contrast',
      start: 4200,
      duration: 1200,
      text: '传统剪辑正在被重构',
      highlight: '传统剪辑',
      background: 'linear-gradient(135deg, #111, #3a1f1f)',
      position: 'bottom',
      animation: 'shake',
      camera: {
        scaleFrom: 1,
        scaleTo: 1.04,
        xFrom: 8,
        xTo: 0,
        yFrom: -6,
        yTo: 0,
        shake: 0.8,
      },
    },
  ]

  const totalDuration =
    scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration

  const totalFrames = Math.floor((totalDuration / 1000) * FPS)

  const [frame, setFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setFrame((prev) => {
        const next = prev + 1
        return next >= totalFrames ? 0 : next
      })
    }, 1000 / FPS)

    return () => clearInterval(timer)
  }, [totalFrames, isPlaying])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setIsPlaying((prev) => !prev)
      }

      if (event.code === 'ArrowLeft') {
        setFrame((prev) => Math.max(prev - 1, 0))
      }

      if (event.code === 'ArrowRight') {
        setFrame((prev) => Math.min(prev + 1, totalFrames - 1))
      }

      if (event.code === 'KeyR') {
        setFrame(0)
        setIsPlaying(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [totalFrames])

  const currentTime = (frame / FPS) * 1000

  const currentScene =
    scenes.find((scene) => {
      return (
        currentTime >= scene.start &&
        currentTime < scene.start + scene.duration
      )
    }) || scenes[0]

  const currentIndex = scenes.indexOf(currentScene)

  const sceneElapsedTime = currentTime - currentScene.start
  const sceneProgress = Math.min(sceneElapsedTime / currentScene.duration, 1)
  const sceneState = getSceneState(sceneProgress)
  const globalProgress = Math.min(currentTime / totalDuration, 1)

  const transitionProgress = getTransitionProgress(sceneProgress, 0.8, 1)

  const easedSceneProgress = easeOutCubic(sceneProgress)

  const cameraScale = interpolate(
    easedSceneProgress,
    currentScene.camera.scaleFrom,
    currentScene.camera.scaleTo
  )

  const baseCameraX = interpolate(
    easedSceneProgress,
    currentScene.camera.xFrom,
    currentScene.camera.xTo
  )

  const baseCameraY = interpolate(
    easedSceneProgress,
    currentScene.camera.yFrom,
    currentScene.camera.yTo
  )

  const shake = cameraShake(currentTime, currentScene.camera.shake)

  const cameraX = baseCameraX + shake.x
  const cameraY = baseCameraY + shake.y

  const jumpToScene = (sceneStart: number) => {
    const targetFrame = Math.floor((sceneStart / 1000) * FPS)
    setFrame(targetFrame)
    setIsPlaying(false)
  }

  const seekGlobalTimeline = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const ratio = clickX / rect.width

    const targetTime = totalDuration * ratio
    const targetFrame = Math.floor((targetTime / 1000) * FPS)

    setFrame(targetFrame)
    setIsPlaying(false)
  }

  const renderCurrentScene = () => {
    return renderSceneByType(currentScene.scene, {
      text: currentScene.text,
      highlight: currentScene.highlight,
      animation: currentScene.animation,
      progress: sceneProgress,
    })
  }

  return (
    <div
      key={currentIndex}
      className={`video scene-transition ${currentScene.position}`}
      style={{
        background: currentScene.background,
      }}
    >
      <DepthLayer
        className="depth-back"
        x={cameraX * 0.15}
        y={cameraY * 0.15}
      >
        <div className="ambient-glow"></div>
      </DepthLayer>

      <div className="debug-panel">
        <div>frame: {frame}</div>
        <div>time: {Math.floor(currentTime)}ms</div>
        <div>scene: {currentScene.scene}</div>
        <div>start: {currentScene.start}ms</div>
        <div>duration: {currentScene.duration}ms</div>
        <div>scene progress: {sceneProgress.toFixed(2)}</div>
        <div>scene state: {sceneState}</div>
        <div>transition progress: {transitionProgress.toFixed(2)}</div>
        <div>global progress: {globalProgress.toFixed(2)}</div>
        <div>camera scale: {cameraScale.toFixed(2)}</div>
        <div>camera x: {cameraX.toFixed(1)}</div>
        <div>camera y: {cameraY.toFixed(1)}</div>
        <div>shake x: {shake.x.toFixed(2)}</div>
        <div>shake y: {shake.y.toFixed(2)}</div>
        <div>status: {isPlaying ? 'playing' : 'paused'}</div>
      </div>

      <div className="timeline-panel">
        {scenes.map((scene, index) => {
          return (
            <button
              key={scene.scene}
              className={
                index === currentIndex
                  ? 'timeline-item active'
                  : 'timeline-item'
              }
              onClick={() => jumpToScene(scene.start)}
            >
              {scene.scene}
            </button>
          )
        })}
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${sceneProgress * 100}%`,
          }}
        ></div>
      </div>

      <div
        className="global-progress-bar"
        onClick={seekGlobalTimeline}
      >
        <div
          className="global-progress-fill"
          style={{
            width: `${globalProgress * 100}%`,
          }}
        ></div>
      </div>

      <button
        className="play-button"
        onClick={() => {
          setIsPlaying(!isPlaying)
        }}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      <div className="shortcut-panel">
        <div>Space : Play/Pause</div>
        <div>← → : Frame Step</div>
        <div>R : Reset</div>
        <div>Click Scene : Jump</div>
        <div>Click Bar : Seek</div>
      </div>

      <DepthLayer
        className="scene-camera depth-middle"
        x={cameraX}
        y={cameraY}
        scale={cameraScale}
      >
        <SceneStatus state={sceneState} />
        <div
          style={{
            ...getExitStyle(transitionProgress),
            ...getEnterStyle(sceneProgress),
          }}
        >
          <SceneTransition progress={sceneProgress}>
            {renderCurrentScene()}
          </SceneTransition>
        </div>
      </DepthLayer>

      <DepthLayer
        className="depth-front"
        x={cameraX * 1.6}
        y={cameraY * 1.6}
      >
        <div className="film-grain"></div>
      </DepthLayer>
    </div>
  )
}

export default App