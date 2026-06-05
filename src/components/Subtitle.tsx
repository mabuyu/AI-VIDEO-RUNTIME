interface SubtitleData {
  id: string
  start: number
  duration: number
  text: string
}

interface SubtitleProps {
  subtitle?: SubtitleData
}

export default function Subtitle({ subtitle }: SubtitleProps) {
  if (!subtitle) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 700,
        textShadow: '0 0 12px rgba(0, 0, 0, 0.8)',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      {subtitle.text}
    </div>
  )
}