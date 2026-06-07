import { useEffect, useState } from 'react'

import DepthLayer from './components/DepthLayer'
import SceneStatus from './components/SceneStatus'
import SceneTransition from './components/SceneTransition'
import Subtitle from './components/Subtitle'
import './App.css'

import { cameraShake } from './utils/camera'
import { getSceneState } from './utils/sceneLifecycle'
import {
  getCurrentScene,
  getCurrentSceneIndex,
  getGlobalProgress,
  getSceneProgress,
  getScenes,
} from './utils/sceneParser'
import { renderSceneByType } from './utils/sceneRenderer'
import { interpolate } from './utils/motion'
import {
  getEnterStyle,
  getExitStyle,
  getTransitionProgress,
} from './utils/transition'
import {
  getTimelineDuration,
  getTimelineFPS,
} from './utils/timelineParser'
import { getCurrentCamera } from './utils/cameraParser'
import { validateCamera } from './utils/cameraValidator'
import { validateTimeline } from './utils/timelineValidator'
import { validateSubtitles } from './utils/subtitleValidator'
import { getCurrentSubtitle } from './utils/subtitleParser'

function App() {
  const FPS = getTimelineFPS()

  const scenes = getScenes()
  const totalDuration = getTimelineDuration()
  const totalFrames = Math.floor((totalDuration / 1000) * FPS)

  const [frame, setFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    console.log('Timeline Validation:', validateTimeline())
    console.log('Subtitle Validation:', validateSubtitles())
    console.log('Camera Validation:', validateCamera())
  }, [])

  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setFrame((prev) => {
        const next = prev + 1
        return next >= totalFrames ? 0 : next
      })
    }, 1000 / FPS)

    return () => clearInterval(timer)
  }, [FPS, totalFrames, isPlaying])

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
  const currentSubtitle = getCurrentSubtitle(currentTime)
  const currentCamera = getCurrentCamera(currentTime)

  const cameraProgress = currentCamera
    ? Math.min(
        Math.max(
          (currentTime - currentCamera.start) / currentCamera.duration,
          0
        ),
        1
      )
    : 0

  const currentScene = getCurrentScene(currentTime)
  const currentIndex = getCurrentSceneIndex(currentTime)
  const sceneProgress = getSceneProgress(currentTime, currentScene)
  const sceneState = getSceneState(sceneProgress)
  const globalProgress = getGlobalProgress(currentTime)
  const transitionProgress = getTransitionProgress(sceneProgress, 0.8, 1)

  const cameraScale = currentCamera
    ? interpolate(
        cameraProgress,
        currentCamera.scaleFrom,
        currentCamera.scaleTo
      )
    : 1

  const baseCameraX = currentCamera
    ? interpolate(
        cameraProgress,
        currentCamera.xFrom,
        currentCamera.xTo
      )
    : 0

  const baseCameraY = currentCamera
    ? interpolate(
        cameraProgress,
        currentCamera.yFrom,
        currentCamera.yTo
      )
    : 0

  const shake = cameraShake(currentTime, currentCamera?.shake ?? 0)
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

    setFrame(Math.floor((targetTime / 1000) * FPS))
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
      style={{ background: currentScene.background }}
    >
      <DepthLayer className="depth-back" x={cameraX * 0.15} y={cameraY * 0.15}>
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
        <div>camera active: {currentCamera ? 'yes' : 'no'}</div>
        <div>camera preset: {currentCamera?.preset ?? 'none'}</div>
        <div>camera progress: {cameraProgress.toFixed(2)}</div>
        <div>shake x: {shake.x.toFixed(2)}</div>
        <div>shake y: {shake.y.toFixed(2)}</div>
        <div>subtitle: {currentSubtitle?.text || 'none'}</div>
        <div>status: {isPlaying ? 'playing' : 'paused'}</div>
      </div>

      <div className="timeline-panel">
        {scenes.map((scene, index) => (
          <button
            key={scene.scene}
            className={
              index === currentIndex ? 'timeline-item active' : 'timeline-item'
            }
            onClick={() => jumpToScene(scene.start)}
          >
            {scene.scene}
          </button>
        ))}
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${sceneProgress * 100}%` }}
        ></div>
      </div>

      <div className="global-progress-bar" onClick={seekGlobalTimeline}>
        <div
          className="global-progress-fill"
          style={{ width: `${globalProgress * 100}%` }}
        ></div>
      </div>

      <button className="play-button" onClick={() => setIsPlaying(!isPlaying)}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      <div className="shortcut-panel">
        <div>Space : Play/Pause</div>
        <div>Left/Right : Frame Step</div>
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
        <SceneStatus
          scene={currentScene.scene}
          state={sceneState}
          index={currentIndex}
          sceneProgress={sceneProgress}
          globalProgress={globalProgress}
          transitionProgress={transitionProgress}
          frame={frame}
          time={currentTime}
        />

        <Subtitle subtitle={currentSubtitle} />

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

      <DepthLayer className="depth-front" x={cameraX * 1.6} y={cameraY * 1.6}>
        <div className="film-grain"></div>
      </DepthLayer>
    </div>
  )
}

export default App