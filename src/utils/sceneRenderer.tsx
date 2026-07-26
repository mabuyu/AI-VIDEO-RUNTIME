import { sceneRegistry } from './sceneRegistry'
import type { RuntimeArtifactInput } from '../runtime'

export function renderRuntimeArtifactInput(input: RuntimeArtifactInput) {
  return (
    <video
      src={input.resource.source}
      width={input.metadata.width}
      height={input.metadata.height}
    />
  )
}

export function renderSceneByType(
  sceneType: string,
  props: any
) {
  const SceneComponent =
    sceneRegistry[sceneType as keyof typeof sceneRegistry]

  if (!SceneComponent) return null

  return <SceneComponent {...props} />
}
