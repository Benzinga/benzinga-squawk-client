import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface AudioPlayerProps {
  stream?: MediaStream
  autoPlay: boolean
  muted: boolean
}

const AudioPlayer = forwardRef(({ stream, autoPlay, muted }: AudioPlayerProps, ref) => {
  const audioElement = useRef(null)
  useImperativeHandle(ref, () => ({
    getAudioElement() {
      return audioElement
    },
  }))
  useEffect(() => {
    audioElement.current.srcObject = stream
  }, [stream])
  return (
    <div className={'audio_player'}>
      <audio ref={audioElement} controls={true} autoPlay={autoPlay} muted={muted} />
    </div>
  )
})

export { AudioPlayer }
