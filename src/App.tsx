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
import {
  getCurrentEffect,
  getEffectProgress,
} from './utils/effectParser'
import { getEffectPreset } from './utils/effectPresets'
import { validateEffects } from './utils/effectValidator'
import {
  getCurrentAudio,
  getAudioProgress,
} from './utils/audioParser'
import { getAudioPreset } from './utils/audioPresets'
import {
  getCurrentDepth,
  getDepthProgress,
} from './utils/depthParser'
import { getDepthPreset } from './utils/depthPresets'
import { validateDepths } from './utils/depthValidator'
import {
  getParallaxOffset,
  getLayerScale,
} from './utils/parallax'
import {
  getCurrentComposition,
  getCompositionProgress,
} from './utils/compositionParser'
import { getCompositionPreset } from './utils/compositionPresets'
import { validateCompositions } from './utils/compositionValidator'
import {
  getAssetCount,
  getPreloadAssetCount,
  hasAsset,
  resolveAsset,
} from './utils/assetRegistry'
import { validateAssets } from './utils/assetValidator'

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
    console.log('Effect Validation:', validateEffects())
    console.log('Depth Validation:', validateDepths())
    console.log('Composition Validation:', validateCompositions())
    console.log('Asset Validation:', validateAssets())
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
  const currentEffect = getCurrentEffect(currentTime)
  const currentAudio = getCurrentAudio(currentTime)
  const currentDepth = getCurrentDepth(currentTime)
  const currentComposition = getCurrentComposition(currentTime)

  const assetCount = getAssetCount()
  const preloadAssetCount = getPreloadAssetCount()
  const heroAssetSrc = resolveAsset('hero-image')
  const hasHeroAsset = hasAsset('hero-image')

  const effectProgress = getEffectProgress(currentTime, currentEffect)
  const effectPreset = currentEffect
    ? getEffectPreset(currentEffect.preset)
    : null

  const audioProgress = getAudioProgress(currentTime, currentAudio)
  const audioPreset = currentAudio
    ? getAudioPreset(currentAudio.preset)
    : null

  const depthProgress = getDepthProgress(currentTime, currentDepth)
  const depthPreset = currentDepth
    ? getDepthPreset(currentDepth.preset)
    : null

  const compositionProgress = getCompositionProgress(
    currentTime,
    currentComposition
  )

  const compositionPreset = currentComposition
    ? getCompositionPreset(currentComposition.preset)
    : null

  let audioGain = 1

  if (audioPreset && currentAudio) {
    audioGain = audioPreset.volume

    if (audioPreset.fadeIn > 0 && audioProgress < audioPreset.fadeIn) {
      audioGain *= audioProgress / audioPreset.fadeIn
    }

    if (audioPreset.fadeOut > 0 && audioProgress > 1 - audioPreset.fadeOut) {
      audioGain *= (1 - audioProgress) / audioPreset.fadeOut
    }
  }

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
    ? interpolate(cameraProgress, currentCamera.xFrom, currentCamera.xTo)
    : 0

  const baseCameraY = currentCamera
    ? interpolate(cameraProgress, currentCamera.yFrom, currentCamera.yTo)
    : 0

  const shake = cameraShake(currentTime, currentCamera?.shake ?? 0)
  const cameraX = baseCameraX + shake.x
  const cameraY = baseCameraY + shake.y

  const backgroundDepth = depthPreset?.background ?? 0.6
  const middleDepth = depthPreset?.middle ?? 1
  const foregroundDepth = depthPreset?.foreground ?? 1.4

  const backgroundOffset = getParallaxOffset(
    cameraX,
    cameraY,
    backgroundDepth
  )

  const middleOffset = getParallaxOffset(cameraX, cameraY, middleDepth)

  const foregroundOffset = getParallaxOffset(
    cameraX,
    cameraY,
    foregroundDepth
  )

  const backgroundScale = getLayerScale(cameraScale, backgroundDepth)
  const middleScale = getLayerScale(cameraScale, middleDepth)
  const foregroundScale = getLayerScale(cameraScale, foregroundDepth)

  const effectFilter = `
    blur(${effectPreset?.blur ?? 0}px)
    brightness(${effectPreset?.brightness ?? 1})
    contrast(${effectPreset?.contrast ?? 1})
    saturate(${effectPreset?.saturation ?? 1})
  `

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
      <DepthLayer
        className="depth-back"
        x={backgroundOffset.x}
        y={backgroundOffset.y}
        scale={backgroundScale}
      >
        <div className="ambient-glow"></div>
        <div className="background-grid"></div>
        <div className="background-orb orb-left"></div>
        <div className="background-orb orb-right"></div>
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

        <div>effect preset: {currentEffect?.preset ?? 'none'}</div>
        <div>effect progress: {effectProgress.toFixed(2)}</div>
        <div>blur: {effectPreset?.blur ?? 0}</div>
        <div>glow: {effectPreset?.glow ?? 0}</div>
        <div>noise: {effectPreset?.noise ?? 0}</div>
        <div>vignette: {effectPreset?.vignette ?? 0}</div>
        <div>bloom: {effectPreset?.bloom ?? 0}</div>
        <div>brightness: {effectPreset?.brightness ?? 1}</div>
        <div>contrast: {effectPreset?.contrast ?? 1}</div>
        <div>saturation: {effectPreset?.saturation ?? 1}</div>

        <div>audio preset: {currentAudio?.preset ?? 'none'}</div>
        <div>audio progress: {audioProgress.toFixed(2)}</div>
        <div>volume: {audioPreset?.volume ?? 0}</div>
        <div>fadeIn: {audioPreset?.fadeIn ?? 0}</div>
        <div>fadeOut: {audioPreset?.fadeOut ?? 0}</div>
        <div>audio gain: {audioGain.toFixed(2)}</div>

        <div>depth preset: {currentDepth?.preset ?? 'none'}</div>
        <div>depth progress: {depthProgress.toFixed(2)}</div>
        <div>depth foreground: {foregroundDepth.toFixed(2)}</div>
        <div>depth middle: {middleDepth.toFixed(2)}</div>
        <div>depth background: {backgroundDepth.toFixed(2)}</div>
        <div>foreground scale: {foregroundScale.toFixed(2)}</div>
        <div>middle scale: {middleScale.toFixed(2)}</div>
        <div>background scale: {backgroundScale.toFixed(2)}</div>

        <div>composition preset: {currentComposition?.preset ?? 'none'}</div>
        <div>composition progress: {compositionProgress.toFixed(2)}</div>
        <div>composition layout: {compositionPreset?.layout ?? 'none'}</div>
        <div>composition emphasis: {compositionPreset?.emphasis ?? 'none'}</div>

        <div>asset count: {assetCount}</div>
        <div>preload asset count: {preloadAssetCount}</div>
        <div>hero asset: {hasHeroAsset ? 'yes' : 'no'}</div>
        <div>hero src: {heroAssetSrc ?? 'none'}</div>

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
        x={middleOffset.x}
        y={middleOffset.y}
        scale={middleScale}
      >
        <div style={{ filter: effectFilter }}>
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
        </div>
      </DepthLayer>

      <DepthLayer
        className="depth-front"
        x={foregroundOffset.x}
        y={foregroundOffset.y}
        scale={foregroundScale}
      >
        <div className="film-grain"></div>
        <div className="foreground-vignette"></div>
        <div className="foreground-light-streak"></div>
      </DepthLayer>
    </div>
  )
}

export default App