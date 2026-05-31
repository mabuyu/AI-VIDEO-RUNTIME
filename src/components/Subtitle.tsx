type SubtitleProps = {
  text: string
  highlight: string
  animation: string
}

function Subtitle(props: SubtitleProps) {

  const parts = props.text.split(props.highlight)

  return (
    <div className={`subtitle ${props.animation}`}>
      {parts[0]}
      <span className="highlight">
        {props.highlight}
      </span>
      {parts[1]}
    </div>
  )
}

export default Subtitle