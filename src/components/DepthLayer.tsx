type DepthLayerProps = {
  children: React.ReactNode
  x: number
  y: number
  scale?: number
  className?: string
}

function DepthLayer({
  children,
  x,
  y,
  scale = 1,
  className = '',
}: DepthLayerProps) {
  return (
    <div
      className={className}
      style={{
        transform: `
          translateX(${x}px)
          translateY(${y}px)
          scale(${scale})
        `,
      }}
    >
      {children}
    </div>
  )
}

export default DepthLayer