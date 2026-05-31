interface Props {
  state: string
}

export default function SceneStatus({ state }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        right: 20,
        color: "#00ffd0",
        fontSize: 12,
        opacity: 0.8
      }}
    >
      scene state: {state}
    </div>
  )
}