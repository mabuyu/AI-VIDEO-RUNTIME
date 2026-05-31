type SceneTransitionProps = {
  children: React.ReactNode
  progress: number
}

function SceneTransition({
  children,
  progress,
}: SceneTransitionProps) {
  const opacity =
    progress < 0.2
      ? progress / 0.2
      : 1

  const blur =
    progress < 0.2
      ? (1 - progress / 0.2) * 20
      : 0

  return (
    <div
      style={{
        opacity,
        filter: `blur(${blur}px)`,
      }}
    >
      {children}
    </div>
  )
}

export default SceneTransition